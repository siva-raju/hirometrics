"""Auth routes — registration, login, activation, password reset."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel, EmailStr
import secrets

from app.db.session import get_db
from app.models.models import (User, Organization, ApplicantProfile,
    UserRole, UserStatus, TermsVersion, TermsAcceptance)
from app.core.security import (verify_password, hash_password,
    create_access_token, create_refresh_token, decode_token,
    generate_temp_password, generate_secure_token)
from app.core.config import settings
from app.core.dependencies import get_current_user

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────
class ApplicantRegister(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    invite_token: str | None = None  # optional — from employer invite link

class EmployerRegister(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    org_name: str
    org_code: str
    industry_type: str | None = None
    website_url: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    must_change_password: bool = False

class AcceptTCRequest(BaseModel):
    tc_version_id: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# ── Helpers ───────────────────────────────────────────────────────────────────
def extract_domain(email: str) -> str:
    return email.lower().split("@")[-1] if "@" in email else ""

async def send_email_placeholder(to: str, subject: str, body: str):
    """Send email via SMTP. Falls back to console log if MAIL_ENABLED is False."""
    print(f"[EMAIL] To: {to} | Subject: {subject}")
    if not settings.MAIL_ENABLED or not settings.MAIL_USERNAME:
        return
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = settings.MAIL_FROM
        msg["To"]      = to
        msg.attach(MIMEText(body, "html"))
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as srv:
            srv.ehlo()
            srv.starttls()
            srv.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            srv.sendmail(settings.MAIL_FROM, [to], msg.as_string())
        print(f"[EMAIL] Sent to {to}")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {to}: {e}")

# ── Registration ──────────────────────────────────────────────────────────────
@router.post("/register/applicant", status_code=201)
async def register_applicant(data: ApplicantRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    activation_code = generate_secure_token()
    user = User(
        email=data.email.lower(),
        email_domain=extract_domain(data.email),
        first_name=data.first_name,
        last_name=data.last_name,
        hashed_password=hash_password(data.password),
        role=UserRole.APPLICANT,
        status=UserStatus.PENDING,
        activation_code=activation_code,
    )
    db.add(user)
    await db.flush()
    profile = ApplicantProfile(user_id=user.id)
    db.add(profile)
    # If invite_token provided, link this invitation to the new user
    if data.invite_token:
        from app.models.models import Invitation
        inv_r = await db.execute(select(Invitation).where(
            Invitation.token == data.invite_token,
            Invitation.candidate_email == data.email.lower(),
            Invitation.status == "pending"
        ))
        inv = inv_r.scalar_one_or_none()
        if inv:
            inv.candidate_id = user.id  # link invitation to new account

    await db.commit()
    activate_url = f"{settings.FRONTEND_URL}/activate/{activation_code}"
    if data.invite_token:
        activate_url += f"?invite={data.invite_token}"
    await send_email_placeholder(data.email, "Please verify your email — HiroMetrics",
        f"Hi {data.first_name},\n\nPlease verify your email: {activate_url}")
    return {"message": "Account created. Check your email to activate.", "user_id": user.id}


@router.post("/register/employer", status_code=201)
async def register_employer(data: EmployerRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    existing_org = await db.execute(select(Organization).where(Organization.org_code == data.org_code.upper()))
    if existing_org.scalar_one_or_none():
        raise HTTPException(400, "Organization code already taken")
    org_domain = extract_domain(data.email)
    org = Organization(
        name=data.org_name,
        org_code=data.org_code.upper(),
        org_domain=org_domain,
        industry_type=data.industry_type,
        website_url=data.website_url,
    )
    db.add(org)
    await db.flush()
    activation_code = generate_secure_token()
    user = User(
        email=data.email.lower(),
        email_domain=org_domain,
        first_name=data.first_name,
        last_name=data.last_name,
        hashed_password=hash_password(data.password),
        role=UserRole.CUSTOMER_ADMIN,
        status=UserStatus.PENDING,
        org_id=org.id,
        activation_code=activation_code,
    )
    db.add(user)
    await db.commit()
    activate_url = f"{settings.FRONTEND_URL}/activate/{activation_code}"
    await send_email_placeholder(data.email, "Please verify your email — HiroMetrics",
        f"Hi {data.first_name},\n\nPlease verify: {activate_url}")
    return {"message": "Employer account created. Check your email to activate.", "user_id": user.id}


@router.post("/activate/{code}")
async def activate_account(code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.activation_code == code))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Invalid or expired activation code")
    user.status = UserStatus.ACTIVE
    user.activation_code = None

    # Check for any pending invitations tied to this email — deliver them now
    from app.models.models import Invitation, Organization
    from app.services.notification_service import notify_user
    inv_r = await db.execute(select(Invitation).where(
        Invitation.candidate_email == user.email,
        Invitation.status == "pending"
    ))
    pending_invitations = inv_r.scalars().all()
    for inv in pending_invitations:
        # Link to user if not already linked
        if not inv.candidate_id:
            inv.candidate_id = user.id
        # Get org name for notification
        org_r = await db.execute(select(Organization).where(Organization.id == inv.org_id))
        org = org_r.scalar_one_or_none()
        org_name = org.name if org else "An employer"
        position_text = f" for {inv.position_title}" if inv.position_title else ""
        await notify_user(
            db=db,
            user_id=user.id,
            title=f"Invitation to apply{position_text}",
            body=(
                f"{org_name} has invited you to apply{position_text}. "
                + (f'"{inv.message}" ' if inv.message else "")
                + "Please check your notifications to accept or decline."
            ),
            notification_type="action_required",
            trigger_event=f"invitation:{inv.id}",
        )

    await db.commit()
    await send_email_placeholder(user.email, "Welcome to HiroMetrics!",
        f"Hi {user.first_name},\n\nWelcome! Your account is now active. Log in at: {settings.FRONTEND_URL}/login")
    return {
        "message": "Account activated successfully",
        "pending_invitations": len(pending_invitations),
    }


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        # Also check temp_password
        if user and user.temp_password and verify_password(form.password, user.temp_password):
            pass
        else:
            raise HTTPException(401, "Incorrect email or password")
    if str(user.status) in ('PENDING', 'pending'):
        raise HTTPException(403, "Account not activated. Check your email.")
    if str(user.status) not in ('ACTIVE', 'active'):
        raise HTTPException(403, "Account is suspended or deactivated.")
    user.last_login = datetime.utcnow()
    await db.commit()
    token_data = {"sub": str(user.id), "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        user_id=str(user.id),
        must_change_password=user.must_change_password,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(refresh_token)
    except ValueError:
        raise HTTPException(401, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid token type")
    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")
    token_data = {"sub": str(user.id), "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        user_id=str(user.id),
    )


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    user = result.scalar_one_or_none()
    if user and user.status == UserStatus.ACTIVE:
        temp_pwd = generate_temp_password()
        user.temp_password = hash_password(temp_pwd)
        user.must_change_password = True
        await db.commit()
        await send_email_placeholder(user.email, "Your HiroMetrics Password",
            f"Hi {user.first_name},\n\nYour temporary password is: {temp_pwd}\n\nPlease log in and change it immediately.")
    return {"message": "If that email exists, a temporary password has been sent."}


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.hashed_password):
        # Allow temp password
        if not (current_user.temp_password and verify_password(data.current_password, current_user.temp_password)):
            raise HTTPException(400, "Current password is incorrect")
    current_user.hashed_password = hash_password(data.new_password)
    current_user.temp_password = None
    current_user.must_change_password = False
    await db.commit()
    await send_email_placeholder(current_user.email, "Your HiroMetrics password has been changed",
        f"Hi {current_user.first_name},\n\nYour password was changed. If you did not do this, contact support immediately.")
    return {"message": "Password changed successfully"}


@router.post("/accept-tc")
async def accept_terms(
    data: AcceptTCRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None
):
    result = await db.execute(select(TermsVersion).where(TermsVersion.id == data.tc_version_id))
    tc = result.scalar_one_or_none()
    if not tc:
        raise HTTPException(404, "Terms version not found")
    current_user.tc_accepted = True
    current_user.tc_version_id = data.tc_version_id
    current_user.tc_accepted_at = datetime.utcnow()
    ip = request.client.host if request else None
    acceptance = TermsAcceptance(user_id=current_user.id, tc_version_id=data.tc_version_id, ip_address=ip)
    db.add(acceptance)
    await db.commit()
    return {"message": "Terms accepted"}


@router.get("/terms/current")
async def get_current_terms(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TermsVersion).where(TermsVersion.is_current == True))
    tc = result.scalar_one_or_none()
    if not tc:
        return {"version": None, "content_candidate": "", "content_employer": ""}
    return {
        "id": tc.id,
        "version_number": tc.version_number,
        "content_candidate": tc.content_candidate,
        "content_employer": tc.content_employer,
        "effective_date": tc.effective_date.isoformat(),
    }


@router.post("/activate-by-email")
async def activate_by_email(data: dict, db: AsyncSession = Depends(get_db)):
    """Dev convenience endpoint — activates account by email without needing the code."""
    email = data.get("email", "").lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if str(user.status).upper() == "ACTIVE":
        return {"message": "Already active"}
    user.status = "active"
    user.activation_code = None
    # Deliver any pending invitations
    from app.models.models import Invitation, Organization
    from app.services.notification_service import notify_user
    inv_r = await db.execute(select(Invitation).where(
        Invitation.candidate_email == email, Invitation.status == "pending"
    ))
    for inv in inv_r.scalars().all():
        if not inv.candidate_id:
            inv.candidate_id = user.id
        org_r = await db.execute(select(Organization).where(Organization.id == inv.org_id))
        org = org_r.scalar_one_or_none()
        org_name = org.name if org else "An employer"
        position_text = f" for {inv.position_title}" if inv.position_title else ""
        await notify_user(db=db, user_id=user.id,
            title=f"Invitation to apply{position_text}",
            body=f"{org_name} has invited you to apply{position_text}.",
            notification_type="action_required", trigger_event=f"invitation:{inv.id}")
    await db.commit()
    return {"message": "Account activated"}
