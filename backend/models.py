import os
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, relationship, scoped_session, sessionmaker


DATABASE_URL = os.getenv("SEWCMS_DATABASE_URL", "sqlite:///sewcms.db")

is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if is_sqlite else {},
)
SessionLocal = scoped_session(sessionmaker(bind=engine, autocommit=False, autoflush=False))
Base = declarative_base()


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    roll = Column(String(50), unique=True, nullable=False, index=True)
    status = Column(String(30), nullable=False, default="Active")
    risk_score = Column(Integer, nullable=False, default=0)
    risk_level = Column(String(10), nullable=False, default="Low")  # Low, Medium, High
    current_ssid = Column(String(120), nullable=True)
    flagged = Column(Boolean, default=False, nullable=False)  # Auto-flagged if risk > threshold
    last_seen = Column(DateTime, nullable=True, index=True)  # Last heartbeat timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    sessions = relationship("Session", back_populates="student", cascade="all, delete-orphan")
    violations = relationship("Violation", back_populates="student", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    grace_period_end = Column(DateTime, nullable=True)  # Allow temporary disconnect without penalty
    disconnected_count = Column(Integer, default=0, nullable=False)  # Track disconnect events
    last_heartbeat = Column(DateTime, nullable=True)  # Last successful heartbeat
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    student = relationship("Student", back_populates="sessions")
    heartbeats = relationship("Heartbeat", back_populates="session", cascade="all, delete-orphan")
    scans = relationship("ScanLog", back_populates="session", cascade="all, delete-orphan")


class Heartbeat(Base):
    __tablename__ = "heartbeats"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False, index=True)
    ssid = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    session = relationship("Session", back_populates="heartbeats")


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    ssid = Column(String(120), nullable=False)
    bssid = Column(String(20), nullable=True)
    rssi = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    session = relationship("Session", back_populates="scans")


class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    violation_type = Column(String(50), nullable=False, index=True)
    details = Column(Text, nullable=True)
    risk_delta = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    student = relationship("Student", back_populates="violations")


class BluetoothLog(Base):
    __tablename__ = "bluetooth_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True, index=True)
    mac = Column(String(50), nullable=False)
    name = Column(String(120), nullable=True)
    rssi = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
