type Fields = Record<string, unknown>;

function write(level: 'info' | 'error', msg: string, fields: Fields) {
  const line = JSON.stringify({ level, msg, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields: Fields = {}) => {
    write('info', msg, fields);
  },
  error: (msg: string, fields: Fields = {}) => {
    write('error', msg, fields);
  },
};

export function describeError(error: unknown): Fields {
  return error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorMessage: String(error) };
}
