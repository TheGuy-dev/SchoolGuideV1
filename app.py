from flask import (
    Flask, request, session, redirect, url_for,
    render_template, flash
)
import os
import sqlite3
import pyotp
import qrcode
import io
import base64
from passlib.context import CryptContext
from flask_talisman import Talisman
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.validators import DataRequired, Length, Regexp

app = Flask(
    __name__,
    static_folder="public",
    static_url_path="",
    template_folder="public"
)
app.secret_key = os.environ.get("FLASK_SECRET", "change-me")

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=(os.getenv('FLASK_ENV') == 'production')
)

csp = {
    'default-src': ["'self'"],
    'script-src':  ["'self'"],
    'style-src':   ["'self'", "https://fonts.googleapis.com"],
    'font-src':    ["'self'", "https://fonts.gstatic.com"],
    'img-src':     ["'self'", "data:", "https://chart.googleapis.com"],
    'connect-src': ["'self'"],
}
Talisman(app, content_security_policy=csp)

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
DB_PATH = "users.db"

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                totp_secret TEXT
            )
        """)
        conn.commit()

def save_user(username, password_hash):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash)
        )
        conn.commit()

def get_user(username):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT id, password_hash, totp_secret FROM users WHERE username = ?",
            (username,)
        ).fetchone()
    if row:
        return {'id': row[0], 'password_hash': row[1], 'totp_secret': row[2]}
    return None

def get_user_by_id(uid):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, totp_secret FROM users WHERE id = ?",
            (uid,)
        ).fetchone()
    if row:
        return {
            'id': row[0],
            'username': row[1],
            'password_hash': row[2],
            'totp_secret': row[3]
        }
    return None

def set_totp_secret(uid, secret):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE users SET totp_secret = ? WHERE id = ?",
            (secret, uid)
        )
        conn.commit()

init_db()

class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(3,50)])
    password = PasswordField('Password', validators=[DataRequired()])
    remember = BooleanField('Remember me')
    submit = SubmitField('Log In')

class RegisterForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(3,50)])
    password = PasswordField('Password', validators=[
        DataRequired(),
        Length(min=8),
        Regexp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$',
               message="Password must include uppercase, lowercase, digit, and special char")
    ])
    submit = SubmitField('Register')

class TOTPForm(FlaskForm):
    token = StringField('Authentication Code', validators=[DataRequired(), Length(6,6)])
    submit = SubmitField('Verify')

PUBLIC_ENDPOINTS = {
    'root', 'login', 'register',
    'two_factor_setup', 'two_factor_verify',
    'static'
}

@app.before_request
def require_login():
    ep = request.endpoint or ''
    if ep not in PUBLIC_ENDPOINTS and not session.get('user_id'):
        return redirect(url_for('login'))

@app.route('/home', endpoint='home')
def home():
    return render_template('index.html')

@app.route('/', endpoint='root')
def root():
    return redirect(url_for('login'))

@app.route('/register', methods=['GET','POST'])
@limiter.limit("5 per minute")
def register():
    form = RegisterForm()
    if form.validate_on_submit():
        username = form.username.data.strip()
        pw_hash = pwd_ctx.hash(form.password.data)
        try:
            save_user(username, pw_hash)
            flash("Registered! Please log in.", "success")
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            flash("Username already taken.", "danger")
    return render_template('register.html', form=form)

@app.route('/login', methods=['GET','POST'])
@limiter.limit("10 per minute")
def login():
    form = LoginForm()
    if form.validate_on_submit():
        user = get_user(form.username.data.strip())
        if not user or not pwd_ctx.verify(form.password.data, user['password_hash']):
            flash("Invalid credentials.", "danger")
        else:
            session.clear()
            session['pre_2fa_user'] = user['id']
            if not user['totp_secret']:
                return redirect(url_for('two_factor_setup'))
            return redirect(url_for('two_factor_verify'))
    return render_template('login.html', form=form)

@app.route('/2fa/setup', methods=['GET','POST'])
def two_factor_setup():
    uid = session.get('pre_2fa_user')
    if not uid:
        return redirect(url_for('login'))

    user = get_user_by_id(uid)
    if not user['totp_secret']:
        secret = pyotp.random_base32()
        set_totp_secret(uid, secret)
        user['totp_secret'] = secret

    totp = pyotp.TOTP(user['totp_secret'])
    otp_uri = totp.provisioning_uri(name=user['username'], issuer_name="School Guide")
    qr = qrcode.make(otp_uri)
    buf = io.BytesIO()
    qr.save(buf, format='PNG')
    qr_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    form = TOTPForm()
    if form.validate_on_submit():
        return redirect(url_for('two_factor_verify'))

    return render_template('2fa_setup.html', form=form, qr_img=qr_b64)

@app.route('/2fa/verify', methods=['GET','POST'])
@limiter.limit("10 per minute")
def two_factor_verify():
    uid = session.get('pre_2fa_user')
    if not uid:
        return redirect(url_for('login'))

    user = get_user_by_id(uid)
    form = TOTPForm()
    if form.validate_on_submit():
        totp = pyotp.TOTP(user['totp_secret'])
        if totp.verify(form.token.data.strip()):
            session.clear()
            session['user_id'] = uid
            return redirect(url_for('home'))
        flash("Invalid 2FA code.", "danger")

    return render_template('2fa_verify.html', form=form)

@app.route('/timetable')
def timetable():
    return render_template('timetable.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/<page>.html')
def serve_page(page):
    return render_template(f"{page}.html")

if __name__ == '__main__':
    app.run(debug=True)
