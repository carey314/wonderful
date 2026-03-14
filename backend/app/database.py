"""
Wonderful 数据库管理
SQLite 连接池和初始化
"""

import sqlite3
from pathlib import Path
from contextlib import contextmanager
from app.config import DB_PATH, BASE_DIR


def get_connection() -> sqlite3.Connection:
    """获取数据库连接"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # 返回字典式结果
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def get_db():
    """数据库连接上下文管理器，自动提交/回滚"""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    """初始化数据库，执行 schema.sql 创建表结构"""
    schema_path = BASE_DIR / "schema.sql"
    if not schema_path.exists():
        raise FileNotFoundError(f"找不到 schema.sql: {schema_path}")

    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    conn = get_connection()
    try:
        conn.executescript(schema_sql)
        conn.commit()
        print(f"[数据库] 初始化成功: {DB_PATH}")
    finally:
        conn.close()
