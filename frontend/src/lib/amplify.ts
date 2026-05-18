import { Amplify } from "aws-amplify";

export function configureAmplify() {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  if (!userPoolId?.trim() || !userPoolClientId?.trim()) {
    // eslint-disable-next-line no-console -- dev feedback
    console.warn(
      "[mini-jira] Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID for sign-in.",
    );
    return;
  }
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: userPoolId.trim(),
        userPoolClientId: userPoolClientId.trim(),
      },
    },
  });
}
