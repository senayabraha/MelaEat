import { NextResponse } from 'next/server';

export const apiError = (code, message, { status = 400, details } = {}) => {
  const payload = { code, message };

  if (details !== undefined) {
    payload.details = details;
  }

  return NextResponse.json(payload, { status });
};

export const validationDetails = (error) =>
  error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join('.') : 'body',
    code: issue.code,
    message: issue.message,
  }));

export const validationError = (error, message = 'Invalid request payload.') =>
  apiError('VALIDATION_ERROR', message, {
    status: 400,
    details: validationDetails(error),
  });

export const readJsonBody = async (request) => {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return {
      ok: false,
      response: apiError('INVALID_JSON', 'Request body must be valid JSON.', { status: 400 }),
    };
  }
};

