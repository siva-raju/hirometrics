"""
HiroMetrics email template system.
All transactional emails share the same base layout and branding.
"""

from string import Template

# ── Brand constants ───────────────────────────────────────────────────────────
HM_BLUE   = "#0078d2"
HM_GREEN  = "#78b41e"
HM_AMBER  = "#f0b400"
HM_ORANGE = "#f0963c"
HM_GRAY   = "#5a5a5a"
NOREPLY   = "no-reply@hirometrics.com"

# ── Base HTML wrapper ─────────────────────────────────────────────────────────
def base_email(subject: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:{HM_BLUE};padding:24px 32px;text-align:center;">
            <span style="font-size:26px;font-weight:bold;color:#ffffff;letter-spacing:-0.5px;">
              Hiro<span style="color:#5ab4f0;">Metrics</span>
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;color:#333333;font-size:15px;line-height:1.6;">
            {body_html}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 40px;border-top:1px solid #eeeeee;text-align:center;">
            <p style="margin:0 0 6px;color:#666666;font-size:13px;">Thanks,<br><strong>HiroMetrics Team</strong></p>
            <p style="margin:0;color:#999999;font-size:11px;">
              Replies to this message are undeliverable. Please do not reply.<br>
              &copy; {__import__('datetime').datetime.now().year} HiroMetrics. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def cta_button(text: str, url: str) -> str:
    return f"""
    <div style="text-align:center;margin:28px 0;">
      <a href="{url}"
         style="background:{HM_BLUE};color:#ffffff;text-decoration:none;
                padding:13px 32px;border-radius:6px;font-size:15px;
                font-weight:bold;display:inline-block;">
        {text}
      </a>
    </div>"""


# ── 1. Email Verification ─────────────────────────────────────────────────────
def email_verification(first_name: str, role: str, verify_url: str) -> tuple[str, str]:
    role_label = "Consultant" if role == "applicant" else "Manager"
    subject = "Please verify your email address — HiroMetrics"
    body = f"""
    <p>Hi {role_label} {first_name},</p>
    <p>Please verify your email address so we know that it's really you!</p>
    <p>Click the button below to activate your HiroMetrics account:</p>
    {cta_button("Verify my email", verify_url)}
    <p style="color:#888;font-size:13px;">
      If you did not create a HiroMetrics account, you can safely ignore this email.
      This link will expire in 48 hours.
    </p>"""
    return subject, base_email(subject, body)


# ── 2. Welcome Email ──────────────────────────────────────────────────────────
def email_welcome(first_name: str, role: str, dashboard_url: str) -> tuple[str, str]:
    role_label = "Consultant" if role == "applicant" else "Manager"
    next_step = (
        "Complete your profile by filling in your demographics, education, experience, and uploading your resume."
        if role == "applicant"
        else "Get started by creating your first job folder and inviting candidates."
    )
    subject = "Welcome to HiroMetrics!"
    body = f"""
    <p>Hi {role_label} {first_name},</p>
    <p>Welcome to <strong>HiroMetrics</strong> — your account has been successfully verified!</p>
    <p>HiroMetrics is your trusted platform to showcase, manage and submit your professional credentials
    with full integrity and transparency.</p>
    <p><strong>Your next step:</strong><br>{next_step}</p>
    {cta_button("Go to my dashboard", dashboard_url)}"""
    return subject, base_email(subject, body)


# ── 3. Password Reset (temporary password) ────────────────────────────────────
def email_password_reset(first_name: str, temp_password: str, login_url: str) -> tuple[str, str]:
    subject = "Your temporary HiroMetrics password"
    body = f"""
    <p>Hi {first_name},</p>
    <p>We received a request to reset your HiroMetrics password.</p>
    <p>Your temporary password is:</p>
    <div style="background:#f0f7ff;border:1px solid #b3d9f5;border-radius:6px;
                padding:16px;text-align:center;margin:20px 0;">
      <span style="font-size:22px;font-weight:bold;color:{HM_BLUE};letter-spacing:2px;">
        {temp_password}
      </span>
    </div>
    <p>Please log in with this temporary password and change it immediately.</p>
    {cta_button("Log in now", login_url)}
    <p style="color:#888;font-size:13px;">
      If you did not request a password reset, please contact us immediately at support@hirometrics.com.
      This temporary password will expire in 1 hour.
    </p>"""
    return subject, base_email(subject, body)


# ── 4. Enrollment Invitation ──────────────────────────────────────────────────
def email_enrollment_invitation(
    invitee_name: str, inviter_name: str, signup_url: str
) -> tuple[str, str]:
    subject = f"{inviter_name} has invited you to join HiroMetrics"
    body = f"""
    <p>Hi {invitee_name},</p>
    <p><strong>{inviter_name}</strong> has invited you to join the HiroMetrics community
    and discover a great way to showcase, manage and submit your job credentials!</p>
    <p>HiroMetrics is a trusted credential verification platform that connects
    qualified candidates with employers — with full transparency and integrity.</p>
    {cta_button("Join HiroMetrics", signup_url)}
    <p style="color:#888;font-size:13px;">
      If you were not expecting this invitation, you can safely ignore this email.
    </p>"""
    return subject, base_email(subject, body)


# ── 5. Invitation to Apply ────────────────────────────────────────────────────
def email_invitation_to_apply(
    candidate_name: str, manager_name: str, org_name: str,
    position: str, accept_url: str
) -> tuple[str, str]:
    subject = f"Invitation to apply — {position} at {org_name}"
    body = f"""
    <p>Hi {candidate_name},</p>
    <p><strong>{manager_name}</strong> from <strong>{org_name}</strong> has invited you
    to submit your HiroMetrics profile for the following position:</p>
    <div style="background:#f0f7ff;border-left:4px solid {HM_BLUE};padding:14px 20px;margin:20px 0;border-radius:0 6px 6px 0;">
      <strong style="font-size:16px;">{position}</strong>
    </div>
    <p>You can accept or decline this invitation from your HiroMetrics dashboard.</p>
    {cta_button("View invitation", accept_url)}
    <p style="color:#888;font-size:13px;">
      Accepting this invitation will share your HiroMetrics profile link with {org_name}.
      Your source profile remains the single source of truth — no copies are made.
    </p>"""
    return subject, base_email(subject, body)


# ── 6. Application Received (hiring manager) ──────────────────────────────────
def email_application_received(
    manager_name: str, candidate_name: str, folder_name: str, inbox_url: str
) -> tuple[str, str]:
    subject = f"New application received — {candidate_name}"
    body = f"""
    <p>Hi {manager_name},</p>
    <p><strong>{candidate_name}</strong> has submitted their HiroMetrics profile
    and it is now in your inbox.</p>
    <p>Folder: <strong>{folder_name}</strong></p>
    {cta_button("View in inbox", inbox_url)}"""
    return subject, base_email(subject, body)


# ── 7. Status Change Notification (candidate) ────────────────────────────────
def email_status_change(
    candidate_name: str, org_name: str, position: str,
    new_status: str, dashboard_url: str
) -> tuple[str, str]:
    status_messages = {
        "shortlisted":    ("You have been shortlisted", HM_GREEN,  "Congratulations! You have been shortlisted for this position."),
        "not_proceeding": ("Application update",         "#e53e3e", "After careful consideration, the hiring team has decided not to proceed with your application at this time."),
        "submitted_up":   ("Your profile has been forwarded", HM_BLUE, "Your profile has been submitted to the next stage of the hiring process."),
        "selected":       ("Offer extended",              HM_GREEN,  "Congratulations! You have been selected and an offer is being extended."),
    }
    label, color, message = status_messages.get(new_status, ("Application update", HM_BLUE, "Your application status has been updated."))
    subject = f"{label} — {position} at {org_name}"
    body = f"""
    <p>Hi {candidate_name},</p>
    <p>There is an update regarding your application for <strong>{position}</strong>
    at <strong>{org_name}</strong>:</p>
    <div style="background:#f8f8f8;border-left:4px solid {color};padding:14px 20px;
                margin:20px 0;border-radius:0 6px 6px 0;">
      {message}
    </div>
    {cta_button("View my dashboard", dashboard_url)}"""
    return subject, base_email(subject, body)


# ── 8. Password Changed Confirmation ──────────────────────────────────────────
def email_password_changed(first_name: str, support_url: str) -> tuple[str, str]:
    subject = "Your HiroMetrics password has been changed"
    body = f"""
    <p>Hi {first_name},</p>
    <p>This is a confirmation that your HiroMetrics password was successfully changed.</p>
    <p>If you did not make this change, please contact our support team immediately:</p>
    {cta_button("Contact support", support_url)}
    <p style="color:#888;font-size:13px;">
      For your security, if you did not initiate this change, please reset your password immediately.
    </p>"""
    return subject, base_email(subject, body)
