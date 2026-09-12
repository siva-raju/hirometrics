"""
HiroMetrics — Complete SQLAlchemy Models v2.0
All entities from the finalized ERD.
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, Enum, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.session import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())

# ── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, PyEnum):
    APPLICANT        = "applicant"
    CUSTOMER_ADMIN   = "customer_admin"
    CUSTOMER_MANAGER = "customer_manager"
    HM_ANALYST       = "hm_analyst"
    HM_QA            = "hm_qa"
    HM_SUPERVISOR    = "hm_supervisor"
    HM_MANAGER       = "hm_manager"
    HM_ADMIN         = "hm_admin"
    HM_SUPER_ADMIN   = "hm_super_admin"

class UserStatus(str, PyEnum):
    PENDING     = "pending"
    ACTIVE      = "active"
    SUSPENDED   = "suspended"
    DEACTIVATED = "deactivated"

class VerificationStatus(str, PyEnum):
    NOT_STARTED     = "not_started"
    IN_PROGRESS     = "in_progress"
    AWAITING_REVIEW = "awaiting_review"
    VERIFIED        = "verified"
    REJECTED        = "rejected"
    EXPIRED         = "expired"

class ApplicationStatus(str, PyEnum):
    RECEIVED       = "received"
    UNDER_REVIEW   = "under_review"
    SHORTLISTED    = "shortlisted"
    NOT_PROCEEDING = "not_proceeding"
    SUBMITTED_UP   = "submitted_up"
    SELECTED       = "selected"

class FlowType(str, PyEnum):
    DIRECT_SHARE     = "direct_share"
    INVITATION       = "invitation"
    JOB_LINK         = "job_link"
    CANDIDATE_VENDOR = "candidate_vendor"

class FolderStatus(str, PyEnum):
    OPEN     = "open"
    CLOSED   = "closed"
    ARCHIVED = "archived"

class InvitationStatus(str, PyEnum):
    PENDING  = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED  = "expired"

class NotificationType(str, PyEnum):
    SYSTEM_ALERT    = "system_alert"
    PLATFORM_UPDATE = "platform_update"
    ACTION_REQUIRED = "action_required"
    INFORMATIONAL   = "informational"

class SubscriptionStatus(str, PyEnum):
    ACTIVE    = "active"
    CANCELLED = "cancelled"
    EXPIRED   = "expired"
    PENDING   = "pending"

class LegalStatus(str, PyEnum):
    US_CITIZEN         = "us_citizen"
    PERMANENT_RESIDENT = "permanent_resident"
    OTHER              = "other"

class AddressType(str, PyEnum):
    CURRENT  = "current"
    PREVIOUS = "previous"

class DocType(str, PyEnum):
    DRIVING_LICENSE    = "driving_license"
    PASSPORT           = "passport"
    WORK_AUTHORIZATION = "work_authorization"

class EmploymentType(str, PyEnum):
    FULL_TIME  = "full_time"
    CONSULTING = "consulting"
    PART_TIME  = "part_time"
    INTERN     = "intern"
    TRAINING   = "training"
    OTHER      = "other"

class EducationLevel(str, PyEnum):
    HIGH_SCHOOL = "high_school"
    DIPLOMA     = "diploma"
    BACHELORS   = "bachelors"
    PG_DEGREE   = "pg_degree"
    DOCTORATE   = "doctorate"
    RESEARCH    = "research"
    OTHER       = "other"

class CertType(str, PyEnum):
    TECHNICAL  = "technical"
    LEADERSHIP = "leadership"
    PROCESS    = "process"
    FUNCTIONAL = "functional"
    SOCIAL     = "social"
    OTHER      = "other"

class RefType(str, PyEnum):
    PROFESSIONAL = "professional"
    PERSONAL     = "personal"
    OTHER        = "other"

class RelationshipType(str, PyEnum):
    MANAGER       = "manager"
    PEER          = "peer"
    DIRECT_REPORT = "direct_report"
    CLIENT        = "client"
    MENTOR        = "mentor"
    OTHER         = "other"

class CorrectionStatus(str, PyEnum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ── Organizations ─────────────────────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id:                   Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    name:                 Mapped[str]       = mapped_column(String(255), nullable=False)
    org_code:             Mapped[str]       = mapped_column(String(50), unique=True, nullable=False)
    org_domain:           Mapped[str]       = mapped_column(String(255), nullable=False, index=True)
    website_url:          Mapped[str|None]  = mapped_column(String(500))
    industry_type:        Mapped[str|None]  = mapped_column(String(100))
    entity_type:          Mapped[str|None]  = mapped_column(String(100))
    logo_url:             Mapped[str|None]  = mapped_column(String(500))
    status:               Mapped[str]       = mapped_column(String(50), default="active")
    onboarded_by:         Mapped[str|None]  = mapped_column(UUID, ForeignKey("users.id"))
    formal_agreement_ref: Mapped[str|None]  = mapped_column(String(255))
    onboarded_at:         Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    created_at:           Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:           Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users:                 Mapped[list["User"]]               = relationship("User", back_populates="organization", foreign_keys="User.org_id")
    subscriptions:         Mapped[list["Subscription"]]       = relationship("Subscription", back_populates="organization")
    folders:               Mapped[list["Folder"]]             = relationship("Folder", back_populates="organization")
    verification_requests: Mapped[list["VerificationRequest"]]= relationship("VerificationRequest", back_populates="organization")


# ── Users ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id:                   Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    email:                Mapped[str]       = mapped_column(String(255), unique=True, nullable=False, index=True)
    email_domain:         Mapped[str]       = mapped_column(String(255), nullable=False, index=True)
    first_name:           Mapped[str]       = mapped_column(String(100), nullable=False)
    last_name:            Mapped[str]       = mapped_column(String(100), nullable=False)
    hashed_password:      Mapped[str]       = mapped_column(String(255), nullable=False)
    temp_password:        Mapped[str|None]  = mapped_column(String(255))
    must_change_password: Mapped[bool]      = mapped_column(Boolean, default=False)
    role:                 Mapped[str]       = mapped_column(String(50), nullable=False)
    status:               Mapped[str]       = mapped_column(String(50), default='PENDING')
    org_id:               Mapped[str|None]  = mapped_column(UUID, ForeignKey("organizations.id"), index=True)
    manager_id:           Mapped[str|None]  = mapped_column(UUID, ForeignKey("users.id"))
    invited_by:           Mapped[str|None]  = mapped_column(UUID, ForeignKey("users.id"))
    profile_photo_url:    Mapped[str|None]  = mapped_column(String(500))
    activation_code:      Mapped[str|None]  = mapped_column(String(100))
    tc_accepted:          Mapped[bool]      = mapped_column(Boolean, default=False)
    tc_version_id:        Mapped[str|None]  = mapped_column(UUID, ForeignKey("terms_versions.id"))
    tc_accepted_at:       Mapped[datetime|None] = mapped_column(DateTime)
    last_login:           Mapped[datetime|None] = mapped_column(DateTime)
    created_at:           Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:           Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization:            Mapped["Organization|None"]       = relationship("Organization", back_populates="users", foreign_keys=[org_id])
    applicant_profile:       Mapped["ApplicantProfile|None"]   = relationship("ApplicantProfile", back_populates="user", uselist=False)
    share_tokens:            Mapped[list["ShareToken"]]        = relationship("ShareToken", back_populates="user", foreign_keys="ShareToken.user_id")
    sent_invitations:        Mapped[list["Invitation"]]        = relationship("Invitation", back_populates="invited_by_user", foreign_keys="Invitation.invited_by")
    notifications:           Mapped[list["UserNotification"]]  = relationship("UserNotification", back_populates="user")
    terms_acceptances:       Mapped[list["TermsAcceptance"]]   = relationship("TermsAcceptance", back_populates="user")
    enrollment_invitations:  Mapped[list["EnrollmentInvitation"]] = relationship("EnrollmentInvitation", back_populates="invited_by_user", foreign_keys="EnrollmentInvitation.invited_by_user_id")


# ── Terms & Conditions ────────────────────────────────────────────────────────

class TermsVersion(Base):
    __tablename__ = "terms_versions"

    id:                Mapped[str]      = mapped_column(UUID, primary_key=True, default=gen_uuid)
    version_number:    Mapped[int]      = mapped_column(Integer, nullable=False, unique=True)
    content_candidate: Mapped[str]      = mapped_column(Text, nullable=False)
    content_employer:  Mapped[str]      = mapped_column(Text, nullable=False)
    effective_date:    Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_current:        Mapped[bool]     = mapped_column(Boolean, default=False, index=True)
    created_at:        Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    acceptances: Mapped[list["TermsAcceptance"]] = relationship("TermsAcceptance", back_populates="terms_version")


class TermsAcceptance(Base):
    __tablename__ = "terms_acceptances"

    id:            Mapped[str]      = mapped_column(UUID, primary_key=True, default=gen_uuid)
    user_id:       Mapped[str]      = mapped_column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    tc_version_id: Mapped[str]      = mapped_column(UUID, ForeignKey("terms_versions.id"), nullable=False)
    accepted_at:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ip_address:    Mapped[str|None] = mapped_column(String(50))

    user:          Mapped["User"]         = relationship("User", back_populates="terms_acceptances")
    terms_version: Mapped["TermsVersion"] = relationship("TermsVersion", back_populates="acceptances")


class EnrollmentInvitation(Base):
    __tablename__ = "enrollment_invitations"

    id:                 Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    invited_by_user_id: Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False)
    invitee_name:       Mapped[str]       = mapped_column(String(255), nullable=False)
    invitee_email:      Mapped[str]       = mapped_column(String(255), nullable=False)
    token:              Mapped[str]       = mapped_column(String(500), unique=True, nullable=False, index=True)
    status:             Mapped[str]       = mapped_column(String(50), default='pending')
    sent_at:            Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    registered_at:      Mapped[datetime|None] = mapped_column(DateTime)
    expires_at:         Mapped[datetime|None] = mapped_column(DateTime)

    invited_by_user: Mapped["User"] = relationship("User", back_populates="enrollment_invitations", foreign_keys=[invited_by_user_id])


# ── Subscriptions ─────────────────────────────────────────────────────────────

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id:                   Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    name:                 Mapped[str]       = mapped_column(String(100), nullable=False)
    price_monthly:        Mapped[float]     = mapped_column(Float, nullable=False)
    verification_credits: Mapped[int]       = mapped_column(Integer, nullable=False)
    is_free_tier:         Mapped[bool]      = mapped_column(Boolean, default=False)
    features:             Mapped[dict|None] = mapped_column(JSONB)
    is_active:            Mapped[bool]      = mapped_column(Boolean, default=True)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id:                Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    org_id:            Mapped[str]       = mapped_column(UUID, ForeignKey("organizations.id"), nullable=False)
    plan_id:           Mapped[str]       = mapped_column(UUID, ForeignKey("subscription_plans.id"), nullable=False)
    credits_remaining: Mapped[int]       = mapped_column(Integer, default=0)
    status:            Mapped[str]       = mapped_column(String(50), default='pending')
    trigger_type:      Mapped[str|None]  = mapped_column(String(50))
    payment_id:        Mapped[str|None]  = mapped_column(String(255))
    payment_date:      Mapped[datetime|None] = mapped_column(DateTime)
    expires_at:        Mapped[datetime|None] = mapped_column(DateTime)
    created_at:        Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)

    organization: Mapped["Organization"]    = relationship("Organization", back_populates="subscriptions")
    plan:         Mapped["SubscriptionPlan"]= relationship("SubscriptionPlan")


# ── Applicant Profile ─────────────────────────────────────────────────────────

class ApplicantProfile(Base):
    __tablename__ = "applicant_profiles"

    id:                   Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    user_id:              Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), unique=True, nullable=False)
    salutation:           Mapped[str|None]  = mapped_column(String(20))
    nick_name:            Mapped[str|None]  = mapped_column(String(100))
    middle_name:          Mapped[str|None]  = mapped_column(String(100))
    gender:               Mapped[str|None]  = mapped_column(String(30))
    ssn_encrypted:        Mapped[str|None]  = mapped_column(String(500))
    date_of_birth:        Mapped[str|None]  = mapped_column(String(20))
    country_of_birth:     Mapped[str|None]  = mapped_column(String(100))
    primary_phone:        Mapped[str|None]  = mapped_column(String(30))
    secondary_phone:      Mapped[str|None]  = mapped_column(String(30))
    headline:             Mapped[str|None]  = mapped_column(String(300))
    summary:              Mapped[str|None]  = mapped_column(Text)
    linkedin_url:         Mapped[str|None]  = mapped_column(String(500))
    legal_status:         Mapped[str|None]  = mapped_column(String(50))
    immigration_category: Mapped[str|None]  = mapped_column(String(100))
    work_auth_notes:      Mapped[str|None]  = mapped_column(Text)
    current_city:         Mapped[str|None]  = mapped_column(String(100))
    current_state:        Mapped[str|None]  = mapped_column(String(100))
    trust_score:          Mapped[float|None]= mapped_column(Float)
    identity_verified:    Mapped[bool]      = mapped_column(Boolean, default=False)
    profile_completeness: Mapped[int]       = mapped_column(Integer, default=0)
    baseline_locked:      Mapped[bool]      = mapped_column(Boolean, default=False)
    baseline_locked_at:   Mapped[datetime|None] = mapped_column(DateTime)
    auth_history:         Mapped[dict|None] = mapped_column(JSONB)
    wizard_step:          Mapped[int]       = mapped_column(Integer, default=0)
    created_at:           Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:           Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user:                Mapped["User"]                  = relationship("User", back_populates="applicant_profile")
    addresses:           Mapped[list["Address"]]         = relationship("Address", back_populates="profile", cascade="all, delete-orphan")
    identity_documents:  Mapped[list["IdentityDocument"]]= relationship("IdentityDocument", back_populates="profile", cascade="all, delete-orphan")
    work_history:        Mapped[list["WorkHistory"]]     = relationship("WorkHistory", back_populates="profile", cascade="all, delete-orphan")
    education:           Mapped[list["Education"]]       = relationship("Education", back_populates="profile", cascade="all, delete-orphan")
    certifications:      Mapped[list["Certification"]]   = relationship("Certification", back_populates="profile", cascade="all, delete-orphan")
    references:          Mapped[list["Reference"]]       = relationship("Reference", back_populates="profile", cascade="all, delete-orphan")
    awards:              Mapped[list["Award"]]           = relationship("Award", back_populates="profile", cascade="all, delete-orphan")
    resumes:             Mapped[list["Resume"]]          = relationship("Resume", back_populates="profile", cascade="all, delete-orphan")
    snapshots:           Mapped[list["ProfileSnapshot"]] = relationship("ProfileSnapshot", back_populates="profile")
    correction_requests: Mapped[list["CorrectionRequest"]] = relationship("CorrectionRequest", back_populates="profile")


class Address(Base):
    __tablename__ = "addresses"
    id:           Mapped[str]      = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:   Mapped[str]      = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    address_type: Mapped[str]      = mapped_column(String(20), default="current")
    street:       Mapped[str|None] = mapped_column(String(255))
    city:         Mapped[str|None] = mapped_column(String(100))
    state:        Mapped[str|None] = mapped_column(String(100))
    country:      Mapped[str|None] = mapped_column(String(100))
    document_url: Mapped[str|None] = mapped_column(String(500))
    created_at:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    profile: Mapped["ApplicantProfile"] = relationship("ApplicantProfile", back_populates="addresses")


class IdentityDocument(Base):
    __tablename__ = "identity_documents"
    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:          Mapped[str]       = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    doc_type:            Mapped[str]       = mapped_column(String(50), nullable=False)
    doc_number:          Mapped[str|None]  = mapped_column(String(100))
    issued_country:      Mapped[str|None]  = mapped_column(String(100))
    issued_state:        Mapped[str|None]  = mapped_column(String(100))
    issued_date:         Mapped[str|None]  = mapped_column(String(20))
    expiry_date:         Mapped[str|None]  = mapped_column(String(20))
    date_of_entry:       Mapped[str|None]  = mapped_column(String(20))
    visa_type:           Mapped[str|None]  = mapped_column(String(100))
    document_url:        Mapped[str|None]  = mapped_column(String(500))
    verification_status: Mapped[str]       = mapped_column(String(30), default="not_started")
    verified_at:         Mapped[datetime|None] = mapped_column(DateTime)
    created_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    profile: Mapped["ApplicantProfile"] = relationship("ApplicantProfile", back_populates="identity_documents")


class WorkHistory(Base):
    __tablename__ = "work_history"
    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:          Mapped[str]       = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    employment_type:     Mapped[str|None]  = mapped_column(String(30))
    title:               Mapped[str]       = mapped_column(String(255), nullable=False)
    employer_name:       Mapped[str]       = mapped_column(String(255), nullable=False)
    employer_street:     Mapped[str|None]  = mapped_column(String(255))
    employer_city:       Mapped[str|None]  = mapped_column(String(100))
    employer_state:      Mapped[str|None]  = mapped_column(String(100))
    employer_country:    Mapped[str|None]  = mapped_column(String(100))
    area_of_industry:    Mapped[str|None]  = mapped_column(String(200))
    start_date:          Mapped[str|None]  = mapped_column(String(20))
    end_date:            Mapped[str|None]  = mapped_column(String(20))
    is_current:          Mapped[bool]      = mapped_column(Boolean, default=False)
    description:         Mapped[str|None]  = mapped_column(Text)
    work_arrangement:    Mapped[str|None]  = mapped_column(String(30))
    client_engagements:  Mapped[dict|None] = mapped_column(JSONB)
    additional_roles:    Mapped[dict|None] = mapped_column(JSONB)
    role_history:        Mapped[dict|None] = mapped_column(JSONB)
    document_url:        Mapped[str|None]  = mapped_column(String(500))
    verification_status: Mapped[str]       = mapped_column(String(30), default="not_started")
    verified_at:         Mapped[datetime|None] = mapped_column(DateTime)
    created_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    profile:              Mapped["ApplicantProfile"]          = relationship("ApplicantProfile", back_populates="work_history")
    employment_references:Mapped[list["EmploymentReference"]] = relationship("EmploymentReference", back_populates="work_history", cascade="all, delete-orphan")


class EmploymentReference(Base):
    __tablename__ = "employment_references"
    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    work_history_id:     Mapped[str]       = mapped_column(UUID, ForeignKey("work_history.id"), nullable=False)
    referee_full_name:   Mapped[str|None]  = mapped_column(String(255))
    referee_designation: Mapped[str|None]  = mapped_column(String(255))
    referee_email:       Mapped[str|None]  = mapped_column(String(255))
    referee_phone:       Mapped[str|None]  = mapped_column(String(30))
    verification_status: Mapped[str]       = mapped_column(String(30), default="not_started")
    created_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    work_history: Mapped["WorkHistory"] = relationship("WorkHistory", back_populates="employment_references")


class Education(Base):
    __tablename__ = "education"
    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:          Mapped[str]       = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    education_level:     Mapped[str|None]  = mapped_column(String(30))
    degree_name:         Mapped[str|None]  = mapped_column(String(255))
    specialization:      Mapped[str|None]  = mapped_column(String(255))
    start_date:          Mapped[str|None]  = mapped_column(String(20))
    end_date:            Mapped[str|None]  = mapped_column(String(20))
    graduation_date:     Mapped[str|None]  = mapped_column(String(20))
    marks_percentage:    Mapped[float|None]= mapped_column(Float)
    grade_obtained:      Mapped[str|None]  = mapped_column(String(50))
    institution_name:    Mapped[str|None]  = mapped_column(String(255))
    institution_country: Mapped[str|None]  = mapped_column(String(100))
    institution_state:   Mapped[str|None]  = mapped_column(String(100))
    institution_city:    Mapped[str|None]  = mapped_column(String(100))
    institution_street:  Mapped[str|None]  = mapped_column(String(255))
    document_url:        Mapped[str|None]  = mapped_column(String(500))
    verification_status: Mapped[str]       = mapped_column(String(30), default="not_started")
    verified_at:         Mapped[datetime|None] = mapped_column(DateTime)
    created_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    profile: Mapped["ApplicantProfile"] = relationship("ApplicantProfile", back_populates="education")


class Certification(Base):
    __tablename__ = "certifications"
    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:          Mapped[str]       = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    cert_type:           Mapped[str|None]  = mapped_column(String(30))
    authority_name:      Mapped[str|None]  = mapped_column(String(255))
    cert_name:           Mapped[str]       = mapped_column(String(255), nullable=False)
    cert_number:         Mapped[str|None]  = mapped_column(String(100))
    cert_version:        Mapped[str|None]  = mapped_column(String(50))
    issued_date:         Mapped[str|None]  = mapped_column(String(20))
    expiry_date:         Mapped[str|None]  = mapped_column(String(20))
    renewal_date:        Mapped[str|None]  = mapped_column(String(20))
    renewal_expiry_date: Mapped[str|None]  = mapped_column(String(20))
    credential_url:      Mapped[str|None]  = mapped_column(String(500))
    document_url:        Mapped[str|None]  = mapped_column(String(500))
    verification_status: Mapped[str]       = mapped_column(String(30), default="not_started")
    verified_at:         Mapped[datetime|None] = mapped_column(DateTime)
    created_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    profile: Mapped["ApplicantProfile"] = relationship("ApplicantProfile", back_populates="certifications")


class Reference(Base):
    __tablename__ = "references"
    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:          Mapped[str]       = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    ref_type:            Mapped[str|None]  = mapped_column(String(30))
    referee_first_name:  Mapped[str]       = mapped_column(String(100), nullable=False)
    referee_last_name:   Mapped[str]       = mapped_column(String(100), nullable=False)
    referee_title:       Mapped[str|None]  = mapped_column(String(255))
    referee_company:     Mapped[str|None]  = mapped_column(String(255))
    referee_email:       Mapped[str]       = mapped_column(String(255), nullable=False)
    referee_phone:       Mapped[str|None]  = mapped_column(String(30))
    referee_country:     Mapped[str|None]  = mapped_column(String(100))
    referee_state:       Mapped[str|None]  = mapped_column(String(100))
    referee_city:        Mapped[str|None]  = mapped_column(String(100))
    relationship_type:        Mapped[str|None]  = mapped_column(String(30))
    relationship_description: Mapped[str|None]  = mapped_column(Text)
    is_active:                Mapped[bool]      = mapped_column(Boolean, default=True)
    verification_token:  Mapped[str|None]  = mapped_column(String(255), unique=True)
    verification_status: Mapped[str]       = mapped_column(String(30), default="not_started")
    verified_at:         Mapped[datetime|None] = mapped_column(DateTime)
    notes:               Mapped[str|None]  = mapped_column(Text)
    created_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    profile: Mapped["ApplicantProfile"] = relationship("ApplicantProfile", back_populates="references")


class Award(Base):
    __tablename__ = "awards"
    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:          Mapped[str]       = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    award_type:          Mapped[str|None]  = mapped_column(String(50))
    award_name:          Mapped[str]       = mapped_column(String(255), nullable=False)
    awarding_body:       Mapped[str|None]  = mapped_column(String(255))
    description:         Mapped[str|None]  = mapped_column(Text)
    award_date:          Mapped[str|None]  = mapped_column(String(20))
    document_url:        Mapped[str|None]  = mapped_column(String(500))
    verification_status: Mapped[str]       = mapped_column(String(30), default="not_started")
    created_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    profile: Mapped["ApplicantProfile"] = relationship("ApplicantProfile", back_populates="awards")


class Resume(Base):
    __tablename__ = "resumes"
    id:                Mapped[str]      = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:        Mapped[str]      = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    version_number:    Mapped[int]      = mapped_column(Integer, nullable=False)
    file_url:          Mapped[str]      = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str]      = mapped_column(String(255))
    file_size_bytes:   Mapped[int|None] = mapped_column(Integer)
    is_current:        Mapped[bool]     = mapped_column(Boolean, default=True)
    description:       Mapped[str|None] = mapped_column(String(120))
    uploaded_at:       Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    profile: Mapped["ApplicantProfile"] = relationship("ApplicantProfile", back_populates="resumes")


class ProfileSnapshot(Base):
    __tablename__ = "profile_snapshots"
    id:              Mapped[str]      = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:      Mapped[str]      = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    profile_version: Mapped[int]      = mapped_column(Integer, nullable=False)
    snapshot_data:   Mapped[dict]     = mapped_column(JSONB, nullable=False)
    snapshotted_at:  Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    triggered_by:    Mapped[str|None] = mapped_column(String(50))
    profile:      Mapped["ApplicantProfile"] = relationship("ApplicantProfile", back_populates="snapshots")
    share_tokens: Mapped[list["ShareToken"]] = relationship("ShareToken", back_populates="profile_snapshot")


class CorrectionRequest(Base):
    __tablename__ = "correction_requests"
    id:              Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    profile_id:      Mapped[str]       = mapped_column(UUID, ForeignKey("applicant_profiles.id"), nullable=False)
    requested_by:    Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False)
    field_name:      Mapped[str]       = mapped_column(String(100), nullable=False)
    section:         Mapped[str]       = mapped_column(String(100), nullable=False)
    old_value:       Mapped[str|None]  = mapped_column(Text)
    requested_value: Mapped[str]       = mapped_column(Text, nullable=False)
    justification:   Mapped[str]       = mapped_column(Text, nullable=False)
    evidence_url:    Mapped[str|None]  = mapped_column(String(500))
    status:          Mapped[str]       = mapped_column(String(20), default="pending")
    reviewed_by:     Mapped[str|None]  = mapped_column(UUID, ForeignKey("users.id"))
    reviewer_notes:  Mapped[str|None]  = mapped_column(Text)
    created_at:      Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at:     Mapped[datetime|None] = mapped_column(DateTime)
    profile: Mapped["ApplicantProfile"] = relationship("ApplicantProfile", back_populates="correction_requests")


# ── Share Tokens ──────────────────────────────────────────────────────────────

class ShareToken(Base):
    __tablename__ = "share_tokens"
    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    user_id:             Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    profile_snapshot_id: Mapped[str]       = mapped_column(UUID, ForeignKey("profile_snapshots.id"), nullable=False)
    token:               Mapped[str]       = mapped_column(String(500), unique=True, nullable=False, index=True)
    label:               Mapped[str|None]  = mapped_column(String(255))
    is_active:           Mapped[bool]      = mapped_column(Boolean, default=True)
    view_count:          Mapped[int]       = mapped_column(Integer, default=0)
    expires_at:          Mapped[datetime|None] = mapped_column(DateTime)
    last_viewed_at:      Mapped[datetime|None] = mapped_column(DateTime)
    created_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    user:             Mapped["User"]              = relationship("User", back_populates="share_tokens", foreign_keys=[user_id])
    profile_snapshot: Mapped["ProfileSnapshot"]   = relationship("ProfileSnapshot", back_populates="share_tokens")
    applications:     Mapped[list["Application"]] = relationship("Application", back_populates="share_token")


# ── Folders & Applications ────────────────────────────────────────────────────

class Folder(Base):
    __tablename__ = "folders"
    id:                Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    org_id:            Mapped[str]       = mapped_column(UUID, ForeignKey("organizations.id"), nullable=False, index=True)
    owner_id:          Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False)
    created_by:        Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False)
    name:              Mapped[str]       = mapped_column(String(255), nullable=False)
    description:       Mapped[str|None]  = mapped_column(Text)
    position_title:    Mapped[str|None]  = mapped_column(String(255))
    skill_set:         Mapped[str|None]  = mapped_column(Text)
    location:          Mapped[str|None]  = mapped_column(String(200))
    work_mode:         Mapped[str|None]  = mapped_column(String(20))
    duration:          Mapped[str|None]  = mapped_column(String(100))
    job_start_date:    Mapped[str|None]  = mapped_column(String(50))
    work_auth_required:Mapped[str|None]  = mapped_column(String(100))
    unique_link_token: Mapped[str]       = mapped_column(String(255), unique=True, nullable=False, index=True)
    status:            Mapped[str]       = mapped_column(String(20), default="open")
    is_archived:       Mapped[bool]      = mapped_column(Boolean, default=False)
    archived_at:       Mapped[datetime|None] = mapped_column(DateTime)
    created_at:        Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:        Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization:     Mapped["Organization"]          = relationship("Organization", back_populates="folders")
    application_links:Mapped[list["ApplicationLink"]] = relationship("ApplicationLink", back_populates="folder")
    applications:     Mapped[list["Application"]]     = relationship("Application", back_populates="folder")


class ApplicationLink(Base):
    __tablename__ = "application_links"
    id:                Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    folder_id:         Mapped[str]       = mapped_column(UUID, ForeignKey("folders.id"), nullable=False)
    token:             Mapped[str]       = mapped_column(String(255), unique=True, nullable=False, index=True)
    label:             Mapped[str|None]  = mapped_column(String(255))
    is_active:         Mapped[bool]      = mapped_column(Boolean, default=True)
    application_count: Mapped[int]       = mapped_column(Integer, default=0)
    created_at:        Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    expires_at:        Mapped[datetime|None] = mapped_column(DateTime)
    folder: Mapped["Folder"] = relationship("Folder", back_populates="application_links")


class Application(Base):
    __tablename__ = "applications"
    id:                    Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    folder_id:             Mapped[str|None]  = mapped_column(UUID, ForeignKey("folders.id"), index=True)
    candidate_id:          Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    share_token_id:        Mapped[str]       = mapped_column(UUID, ForeignKey("share_tokens.id"), nullable=False)
    parent_application_id: Mapped[str|None]  = mapped_column(UUID, ForeignKey("applications.id"))
    submitted_by_org_id:   Mapped[str|None]  = mapped_column(UUID, ForeignKey("organizations.id"))
    submitted_by_user_id:  Mapped[str|None]  = mapped_column(UUID, ForeignKey("users.id"))
    flow_type:             Mapped[str]       = mapped_column(String(30), nullable=False)
    chain_depth:           Mapped[int]       = mapped_column(Integer, default=0)
    status:                Mapped[str]       = mapped_column(String(30), default="received")
    is_flagged:            Mapped[bool]      = mapped_column(Boolean, default=False)
    consistency_score:     Mapped[str|None]  = mapped_column(String(20))          # ← ADDED
    discrepancies:         Mapped[dict|None] = mapped_column(JSONB)               # ← ADDED
    comments:              Mapped[str|None]  = mapped_column(Text)
    cover_message:         Mapped[str|None]  = mapped_column(Text)
    internal_notes:        Mapped[str|None]  = mapped_column(Text)
    resume_id:             Mapped[str|None]  = mapped_column(UUID, ForeignKey("resumes.id"))
    received_at:           Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    status_updated_at:     Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    folder:      Mapped["Folder|None"]        = relationship("Folder", back_populates="applications")
    share_token: Mapped["ShareToken"]         = relationship("ShareToken", back_populates="applications")
    children:    Mapped[list["Application"]]  = relationship("Application", foreign_keys=[parent_application_id])


class Invitation(Base):
    __tablename__ = "invitations"
    id:              Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    org_id:          Mapped[str]       = mapped_column(UUID, ForeignKey("organizations.id"), nullable=False)
    folder_id:       Mapped[str|None]  = mapped_column(UUID, ForeignKey("folders.id"))
    invited_by:      Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False)
    candidate_email: Mapped[str]       = mapped_column(String(255), nullable=False)
    candidate_id:    Mapped[str|None]  = mapped_column(UUID, ForeignKey("users.id"))
    position_title:  Mapped[str|None]  = mapped_column(String(255))
    message:         Mapped[str|None]  = mapped_column(Text)
    status:          Mapped[str]       = mapped_column(String(20), default="pending")
    token:           Mapped[str]       = mapped_column(String(255), unique=True, nullable=False, index=True)
    sent_at:         Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    responded_at:    Mapped[datetime|None] = mapped_column(DateTime)
    expires_at:      Mapped[datetime|None] = mapped_column(DateTime)
    invited_by_user: Mapped["User"] = relationship("User", back_populates="sent_invitations", foreign_keys=[invited_by])


class CandidateVendorRequest(Base):
    __tablename__ = "candidate_vendor_requests"
    id:             Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    candidate_id:   Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False)
    share_token_id: Mapped[str]       = mapped_column(UUID, ForeignKey("share_tokens.id"), nullable=False)
    vendor_email:   Mapped[str]       = mapped_column(String(255), nullable=False)
    vendor_org_id:  Mapped[str|None]  = mapped_column(UUID, ForeignKey("organizations.id"))
    message:        Mapped[str|None]  = mapped_column(Text)
    status:         Mapped[str]       = mapped_column(String(20), default="pending")
    requested_at:   Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    responded_at:   Mapped[datetime|None] = mapped_column(DateTime)


class VerificationRequest(Base):
    __tablename__ = "verification_requests"
    id:              Mapped[str]      = mapped_column(UUID, primary_key=True, default=gen_uuid)
    org_id:          Mapped[str]      = mapped_column(UUID, ForeignKey("organizations.id"), nullable=False)
    requested_by:    Mapped[str]      = mapped_column(UUID, ForeignKey("users.id"), nullable=False)
    applicant_email: Mapped[str]      = mapped_column(String(255), nullable=False)
    applicant_id:    Mapped[str|None] = mapped_column(UUID, ForeignKey("users.id"))
    status:          Mapped[str]      = mapped_column(String(30), default="not_started")
    message:         Mapped[str|None] = mapped_column(Text)
    created_at:      Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    organization: Mapped["Organization"] = relationship("Organization", back_populates="verification_requests")


# ── Notifications ─────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"
    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    title:               Mapped[str]       = mapped_column(String(255), nullable=False)
    body:                Mapped[str]       = mapped_column(Text, nullable=False)
    notification_type:   Mapped[str]       = mapped_column(String(30), nullable=False)
    target_role:         Mapped[str|None]  = mapped_column(String(50))
    target_user_id:      Mapped[str|None]  = mapped_column(UUID, ForeignKey("users.id"))
    created_by:          Mapped[str|None]  = mapped_column(UUID, ForeignKey("users.id"))
    is_system_generated: Mapped[bool]      = mapped_column(Boolean, default=False)
    trigger_event:       Mapped[str|None]  = mapped_column(String(100))
    created_at:          Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    deliveries: Mapped[list["UserNotification"]] = relationship("UserNotification", back_populates="notification")


class UserNotification(Base):
    __tablename__ = "user_notifications"
    id:              Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    notification_id: Mapped[str]       = mapped_column(UUID, ForeignKey("notifications.id"), nullable=False, index=True)
    user_id:         Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    is_read:         Mapped[bool]      = mapped_column(Boolean, default=False)
    is_deleted:      Mapped[bool]      = mapped_column(Boolean, default=False)
    read_at:         Mapped[datetime|None] = mapped_column(DateTime)
    deleted_at:      Mapped[datetime|None] = mapped_column(DateTime)
    created_at:      Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    notification: Mapped["Notification"] = relationship("Notification", back_populates="deliveries")
    user:         Mapped["User"]         = relationship("User", back_populates="notifications")


# ── Submission Reviews (HM Review Lifecycle) ──────────────────────────────────

class SubmissionReview(Base):
    __tablename__ = "submission_reviews"

    id:                          Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    application_id:              Mapped[str|None]  = mapped_column(UUID, ForeignKey("applications.id"), index=True)
    candidate_id:                Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    folder_id:                   Mapped[str|None]  = mapped_column(UUID, ForeignKey("folders.id"), index=True)
    status:                      Mapped[str]       = mapped_column(String(30), default="awaiting_review")
    discrepancy_report_url:      Mapped[str|None]  = mapped_column(Text)
    discrepancy_report_filename: Mapped[str|None]  = mapped_column(String(255))
    disposition_flag:            Mapped[str|None]  = mapped_column(String(20))
    comments:                    Mapped[str|None]  = mapped_column(Text)
    sent_at:                     Mapped[datetime|None] = mapped_column(DateTime)
    sent_by:                     Mapped[str|None]  = mapped_column(UUID, ForeignKey("users.id"))
    archived:                    Mapped[bool]      = mapped_column(Boolean, default=False)
    created_at:                  Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:                  Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ── Candidate Job Link Inbox ───────────────────────────────────────────────────

class CandidateJobLink(Base):
    __tablename__ = "candidate_job_links"

    id:                  Mapped[str]       = mapped_column(UUID, primary_key=True, default=gen_uuid)
    candidate_id:        Mapped[str]       = mapped_column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    application_link_id: Mapped[str]       = mapped_column(UUID, ForeignKey("application_links.id"), nullable=False)
    folder_id:           Mapped[str|None]  = mapped_column(UUID, ForeignKey("folders.id"))
    status:              Mapped[str]       = mapped_column(String(20), default="pending")
    attached_resume_id:  Mapped[str|None]  = mapped_column(UUID, ForeignKey("resumes.id"))
    added_at:            Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)
