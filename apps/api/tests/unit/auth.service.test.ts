import bcrypt from 'bcryptjs';
import { createAuthService } from '../../src/services/auth.service';
import type { UserRepository } from '../../src/repositories/user.repository';

function mockRepository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    ...overrides,
  } as unknown as UserRepository;
}

describe('authService.register', () => {
  it('rejects when the email is already taken, without touching the repository create method', async () => {
    const repository = mockRepository({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', email: 'taken@example.com' }),
    });
    const service = createAuthService(repository);

    await expect(
      service.register({ email: 'taken@example.com', password: 'password123', name: 'A' }),
    ).rejects.toThrow('Email already registered');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('hashes the password before persisting and returns a signed token', async () => {
    const created = { id: 'u1', email: 'new@example.com', name: 'New', passwordHash: 'hashed' };
    const repository = mockRepository({
      create: jest.fn().mockResolvedValue(created),
    });
    const service = createAuthService(repository);

    const result = await service.register({ email: 'new@example.com', password: 'password123', name: 'New' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', name: 'New' }),
    );
    const [[createArgs]] = (repository.create as jest.Mock).mock.calls;
    expect(createArgs.passwordHash).not.toBe('password123');
    expect(result.user).toBe(created);
    expect(typeof result.token).toBe('string');
  });
});

describe('authService.login', () => {
  it('rejects an unknown email without revealing that the account does not exist', async () => {
    const repository = mockRepository();
    const service = createAuthService(repository);

    await expect(service.login({ email: 'ghost@example.com', password: 'x' })).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const repository = mockRepository({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@example.com', passwordHash }),
    });
    const service = createAuthService(repository);

    await expect(service.login({ email: 'a@example.com', password: 'wrong' })).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('returns the user and a token on correct credentials', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const user = { id: 'u1', email: 'a@example.com', passwordHash };
    const repository = mockRepository({ findByEmail: jest.fn().mockResolvedValue(user) });
    const service = createAuthService(repository);

    const result = await service.login({ email: 'a@example.com', password: 'correct-password' });

    expect(result.user).toBe(user);
    expect(typeof result.token).toBe('string');
  });
});
