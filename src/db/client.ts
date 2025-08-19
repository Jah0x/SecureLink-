import pg from 'pg';
const { types } = pg;

// NUMERIC -> number
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// TIMESTAMP WITHOUT TIME ZONE -> Date
types.setTypeParser(1114, (v) => new Date(v + 'Z'));
// TIMESTAMPTZ -> Date
types.setTypeParser(1184, (v) => new Date(v));

export default pg;
