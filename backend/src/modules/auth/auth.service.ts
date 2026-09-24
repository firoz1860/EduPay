import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { verifyPassword, hashPassword } from '../../lib/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type JwtPayload,
  type UserRole,
} from '../../lib/jwt';
import { UnauthorizedError, NotFoundError, ConflictError, ForbiddenError } from '../../lib/errors';
import { recordAudit } from '../../services/audit.service';
import type { LoginInput, RegisterInput } from './auth.schema';

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
  studentId: string | null;
}

export interface AuthResult {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
}

async function toDto(userId: string): Promise<AuthUserDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { students: { select: { id: true }, take: 1 } },
  });
  if (!user) throw new NotFoundError('User not found');
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as UserRole,
    avatarUrl: user.avatarUrl,
    studentId: user.students[0]?.id ?? null,
  };
}

function issueTokens(dto: AuthUserDto): AuthResult {
  const payload: JwtPayload = {
    sub: dto.id,
    email: dto.email,
    role: dto.role,
    name: dto.fullName,
    studentId: dto.studentId,
  };
  return {
    user: dto,
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ sub: dto.id }),
  };
}

export async function login(input: LoginInput, requestId: string): Promise<AuthResult> {
  const user = await prisma.user.findFirst({
    where: { email: input.email, isActive: true },
    include: { students: { select: { id: true }, take: 1 } },
  });

  // Constant-ish behavior: always run a bcrypt compare to reduce user-enumeration timing signal.
  const valid = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyPassword(input.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv');

  if (!user || !valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const dto: AuthUserDto = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as UserRole,
    avatarUrl: user.avatarUrl,
    studentId: user.students[0]?.id ?? null,
  };

  await recordAudit(prisma, {
    actor: { sub: dto.id, name: dto.fullName, role: dto.role },
    action: 'USER_LOGIN',
    entity: 'User',
    entityId: dto.id,
    requestId,
  });

  return issueTokens(dto);
}

/**
 * Self-registration (gated by ALLOW_OPEN_REGISTRATION). Creates a user with a
 * bcrypt-hashed password and returns tokens (auto-login). Duplicate emails are
 * rejected. NOTE: open role selection is a demo convenience; in production this
 * should be disabled and staff accounts created by an admin.
 */
export async function register(input: RegisterInput, requestId: string): Promise<AuthResult> {
  if (!env.ALLOW_OPEN_REGISTRATION) {
    throw new ForbiddenError('Self-registration is disabled. Contact an administrator for an account.');
  }

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        isActive: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('An account with this email already exists');
    }
    throw err;
  }

  const dto: AuthUserDto = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as UserRole,
    avatarUrl: user.avatarUrl,
    studentId: null,
  };

  await recordAudit(prisma, {
    actor: { sub: dto.id, name: dto.fullName, role: dto.role },
    action: 'USER_CREATED',
    entity: 'User',
    entityId: dto.id,
    newValue: { email: dto.email, role: dto.role },
    reason: 'Self-registration',
    requestId,
  });

  return issueTokens(dto);
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  const { sub } = verifyRefreshToken(refreshToken);
  const dto = await toDto(sub);
  return issueTokens(dto);
}

export async function me(userId: string): Promise<AuthUserDto> {
  return toDto(userId);
}
