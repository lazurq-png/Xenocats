// The demo user's session, saved once per run by auth.setup.ts. A spec that needs
// a logged-in page, but not the login form itself, starts with it:
//   test.use({ storageState: DEMO_USER });
// The login form is tested in dashboard.spec.ts, login-limit.spec.ts and
// change-password.spec.ts, which log in through it.
export const DEMO_USER = 'playwright/.auth/demo-user.json';
