import { PrismaClient } from '@prisma/client';
import prismaClient from '../db/prisma';
import { UserCompactIn, UserCompleteOut } from '../types/UserTypes';
import { JWTPayload, UserLogin, ExpressSession } from '../types/AuthTypes';
import bcrypt from 'bcryptjs';
import { RolesEnum } from '../types/Enums';
import jwt from 'jsonwebtoken';
import { InvalidCredentialsError } from '../exceptions/AuthError';
import { isRecordNotFound } from '../utils/prismaErrors';

export class AuthService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async signup(
    userDTO: UserCompactIn,
    roles = [RolesEnum.RestaurantOwner]
  ): Promise<UserCompleteOut | never> {
    userDTO.password = await this.hashPassword(userDTO.password);
    const rolesObj = roles.map((role) => ({ role }));
    return this.prisma.user.create({
      data: {
        ...userDTO,
        roles: {
          create: rolesObj,
        },
        userProfile: {
          create: {},
        },
      },
      select: {
        id: true,
        phoneNumber: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
  }

  async signin({ phoneNumber, password }: UserLogin): Promise<ExpressSession | never> {
    const user = await this.prisma.user
      .findUniqueOrThrow({
        where: {
          phoneNumber,
        },
        include: {
          roles: true,
          // Slim session payload (Phase-2): only ids are needed for permission
          // checks — full branch/menu objects bloated Redis and went stale.
          restaurants: {
            select: {
              id: true,
              branches: {
                select: {
                  id: true,
                  backlog: { select: { id: true } },
                  menus: { select: { id: true } },
                },
              },
            },
          },
        },
      })
      .catch((error: Error) => {
        if (isRecordNotFound(error)) throw new InvalidCredentialsError();
        throw error;
      });

    const isCorrectPassword = await this.comparePassword(password, user.password ?? '');
    if (!isCorrectPassword) throw new InvalidCredentialsError();

    const roles = user.roles.map((role) => role.role) as RolesEnum[];
    const token = this.generateAuthToken({ userId: user.id, roles });

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        phoneNumber: user.phoneNumber,
        restaurants: user.restaurants.map((restaurant) => ({
          id: restaurant.id,
          branches: restaurant.branches.map((branch) => ({
            id: branch.id,
            backlogId: branch.backlog?.id,
            menus: branch.menus.map((menu) => menu.id),
          })),
        })),
      },
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  private async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAuthToken(payload: JWTPayload): string {
    // 12h access token (down from 2d). Session cookie remains 2d.
    // Shorter window limits replay after cookie theft without
    // forcing a refresh-token system yet.
    let secret: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getEnv } = require('../config/env') as typeof import('../config/env');
      secret = getEnv().JWT_PRIVATE_KEY;
    } catch {
      secret = process.env.JWT_PRIVATE_KEY as string;
    }
    return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '12h' });
  }
}

let shared: AuthService | undefined;

/** Lazy singleton accessor — no Prisma work happens on import. */
export function getAuthService(): AuthService {
  if (!shared) shared = new AuthService();
  return shared;
}
