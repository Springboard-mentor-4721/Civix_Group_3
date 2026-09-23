import sys
sys.path.insert(0, '.')

from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text('SET FOREIGN_KEY_CHECKS = 0'))
    result = conn.execute(text('SHOW TABLES'))
    tables = [row[0] for row in result]
    print(f'Found {len(tables)} tables: {tables}', flush=True)
    for t in tables:
        conn.execute(text(f'TRUNCATE TABLE `{t}`'))
        print(f'  Cleared: {t}', flush=True)
    conn.execute(text('SET FOREIGN_KEY_CHECKS = 1'))
    conn.commit()

print('All tables cleared.', flush=True)
