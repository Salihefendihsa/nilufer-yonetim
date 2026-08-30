import type { Request } from "express";

export function idParam(req: Request): string {
  return req.params.id as string;
}
