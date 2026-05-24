import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function conflict(message: string) {
  return err(message, 409);
}

export function gone(message: string) {
  return err(message, 410);
}

export function notFound(message: string) {
  return err(message, 404);
}

export function badRequest(message: string) {
  return err(message, 400);
}

export function serverError(message = "Internal server error") {
  return err(message, 500);
}
