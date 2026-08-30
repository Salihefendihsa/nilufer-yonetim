import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";

const SALT_ROUNDS = 10;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(Role).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const { email, password, fullName, phone, role } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      phone,
      role: role ?? Role.CUSTOMER,
    },
  });

  const token = signToken({ sub: user.id, role: user.role, email: user.email });

  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ sub: user.id, role: user.role, email: user.email });

  return res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  });
}
