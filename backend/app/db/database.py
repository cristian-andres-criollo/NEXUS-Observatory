from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# SQLite para desarrollo local, PostgreSQL para Railway
_connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    # Importar modelos para que SQLAlchemy los registre
    from app.models import conversation, document, evaluation, user, system  # noqa
    Base.metadata.create_all(bind=engine)
    print("[OK] Tablas creadas en la base de datos")
    
    # Inicializar usuarios y configuraciones
    db = SessionLocal()
    try:
        from app.models.user import User
        from app.models.system import SystemSettings, PaymentMethod
        import bcrypt
        
        def get_password_hash(password):
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
            return hashed.decode('utf-8')

        # Crear configuraciones por defecto si no existen
        sys_settings = db.query(SystemSettings).first()
        if not sys_settings:
            db.add(SystemSettings(budget_cop=500000, trm_usd_cop=4200.0, groq_cost_per_million=0.69))

        # Crear tarjetas de crédito simuladas si no existen
        if db.query(PaymentMethod).count() == 0:
            cards = [
                PaymentMethod(card_holder="NEXUS Observatory", card_type="VISA", bank_name="Bancolombia",
                              last_four="4242", available_balance_cop=2000000, is_active=True,
                              color_from="#0e4aff", color_to="#00d4ff"),
                PaymentMethod(card_holder="NEXUS Observatory", card_type="MASTERCARD", bank_name="Davivienda",
                              last_four="8891", available_balance_cop=1500000, is_active=True,
                              color_from="#d93e0a", color_to="#ffae00"),
                PaymentMethod(card_holder="NEXUS Observatory", card_type="AMEX", bank_name="Nequi Digital",
                              last_four="0073", available_balance_cop=500000, is_active=False,
                              color_from="#6a0dad", color_to="#ff00ff"),
            ]
            for c in cards:
                db.add(c)

        # 1. Crear admin si no existe (Enterprise)
        admin_email = "tovarcristian431@gmail.com"
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            db.add(User(
                email=admin_email,
                hashed_password=get_password_hash("Criollo12345*"),
                role="admin",
                plan="enterprise"
            ))
            
        # 2. Crear usuario de prueba Team si no existe
        team_email = "prueba1@nexus.com"
        team_user = db.query(User).filter(User.email == team_email).first()
        if not team_user:
            db.add(User(
                email=team_email,
                hashed_password=get_password_hash("prueba123"),
                role="user",
                plan="team"
            ))

        # 3. Crear usuario de prueba Community si no existe
        community_email = "criollo@gmail.com"
        community_user = db.query(User).filter(User.email == community_email).first()
        if not community_user:
            db.add(User(
                email=community_email,
                hashed_password=get_password_hash("prueba123"),
                role="user",
                plan="community"
            ))
        
        db.commit()
        print("[OK] Base de datos inicializada")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error al inicializar usuarios: {e}")
    finally:
        db.close()
