import { faker } from "@faker-js/faker";
import fs from "fs";
import path from "path";
import { signupTestUser } from "./signup";
import { getBrowser } from "./get-browser";

export interface TestUser {
  email: string;
  password: string;
  id?: string;
  createdAt?: string;
}

export interface UserPool {
  users: TestUser[];
  createdAt: string;
  version: string;
}

export async function createTestUser(
  email?: string,
  password?: string,
  ignoreOnboarding: boolean = true,
): Promise<TestUser> {
  const userEmail = email || faker.internet.email();
  const userPassword = password || faker.internet.password({ length: 12 });

  try {
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const testUser = await signupTestUser(
        page,
        userEmail,
        userPassword,
        ignoreOnboarding,
        false,
      );
      return testUser;
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
  } catch (error) {
    throw error;
  }
}

export async function createTestUsers(count: number): Promise<TestUser[]> {
  const users: TestUser[] = [];
  let consecutiveFailures = 0;

  for (let i = 0; i < count; i++) {
    try {
      const user = await createTestUser();
      users.push(user);
      consecutiveFailures = 0; // Reset failure counter on success

      // Small delay to prevent overwhelming the system
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch {
      consecutiveFailures++;

      // If we have too many consecutive failures, stop trying
      if (consecutiveFailures >= 3) {
        break;
      }

      // Add a longer delay after failure to let system recover
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return users;
}

export async function saveUserPool(
  users: TestUser[],
  filePath?: string,
): Promise<void> {
  const defaultPath = path.resolve(process.cwd(), ".auth", "user-pool.json");
  const finalPath = filePath || defaultPath;

  // Ensure .auth directory exists
  const dirPath = path.dirname(finalPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const userPool: UserPool = {
    users,
    createdAt: new Date().toISOString(),
    version: "1.0.0",
  };

  try {
    fs.writeFileSync(finalPath, JSON.stringify(userPool, null, 2));
  } catch (error) {
    throw error;
  }
}

export async function loadUserPool(
  filePath?: string,
): Promise<UserPool | null> {
  const defaultPath = path.resolve(process.cwd(), ".auth", "user-pool.json");
  const finalPath = filePath || defaultPath;

  try {
    if (!fs.existsSync(finalPath)) {
      return null;
    }

    const fileContent = fs.readFileSync(finalPath, "utf-8");
    const userPool: UserPool = JSON.parse(fileContent);

    return userPool;
  } catch {
    return null;
  }
}

export async function getTestUser(): Promise<TestUser> {
  const userPool = await loadUserPool();
  if (!userPool) {
    throw new Error("User pool not found");
  }

  if (userPool.users.length === 0) {
    throw new Error("No users available in the pool");
  }

  // Return a random user from the pool
  const randomIndex = Math.floor(Math.random() * userPool.users.length);
  return userPool.users[randomIndex];
}
