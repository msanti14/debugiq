import type { KeychainService } from "../keychain/KeychainService";
import { KEYCHAIN_KEYS } from "../keychain/KeychainService";
import type { BackendClient } from "../api/BackendClient";
import type { TokenResponse, UserResponse } from "@debugiq/shared-types";

export class AuthService {
  constructor(
    private readonly keychain: KeychainService,
    private readonly client: BackendClient,
  ) {}

  async register(email: string, password: string, displayName?: string): Promise<void> {
    await this.client.post<unknown>("/auth/register", { email, password, display_name: displayName });
  }

  async login(email: string, password: string): Promise<void> {
    const tokens = await this.client.post<TokenResponse>("/auth/login", { email, password });
    await this.keychain.store(KEYCHAIN_KEYS.ACCESS_TOKEN, tokens.access_token);
    await this.keychain.store(KEYCHAIN_KEYS.REFRESH_TOKEN, tokens.refresh_token);
  }

  async logout(): Promise<void> {
    const refreshToken = await this.keychain.get(KEYCHAIN_KEYS.REFRESH_TOKEN);
    if (refreshToken) {
      try {
        const accessToken = await this.keychain.get(KEYCHAIN_KEYS.ACCESS_TOKEN);
        await this.client.post<unknown>("/auth/logout", { refresh_token: refreshToken }, accessToken);
      } catch {
        // best-effort: always clear local tokens even if server call fails
      }
    }
    await this.keychain.delete(KEYCHAIN_KEYS.ACCESS_TOKEN);
    await this.keychain.delete(KEYCHAIN_KEYS.REFRESH_TOKEN);
  }

  async refreshTokens(): Promise<string> {
    const refreshToken = await this.keychain.get(KEYCHAIN_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      throw new Error("No refresh token stored — user must log in again");
    }
    const tokens = await this.client.post<TokenResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    await this.keychain.store(KEYCHAIN_KEYS.ACCESS_TOKEN, tokens.access_token);
    await this.keychain.store(KEYCHAIN_KEYS.REFRESH_TOKEN, tokens.refresh_token);
    return tokens.access_token;
  }

  async getAccessToken(): Promise<string | undefined> {
    return this.keychain.get(KEYCHAIN_KEYS.ACCESS_TOKEN);
  }

  async isLoggedIn(): Promise<boolean> {
    const token = await this.keychain.get(KEYCHAIN_KEYS.ACCESS_TOKEN);
    return !!token;
  }
}
