export function queryOne(db, sql, params = []) {
    const row = db.prepare(sql).get(...params);
    return row ?? null;
}
export function queryExists(db, sql, params = []) {
    return queryOne(db, sql, params) !== null;
}
export function queryAll(db, sql, params = []) {
    return db.prepare(sql).all(...params);
}
export function runStatement(db, sql, params = []) {
    db.prepare(sql).run(...params);
}
export function getLastInsertId(db) {
    const row = queryOne(db, 'SELECT last_insert_rowid() AS id');
    return row?.id ?? 0;
}
