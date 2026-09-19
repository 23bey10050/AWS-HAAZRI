import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({ region: process.env.REACT_APP_AWS_REGION });
const ClientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;

export async function requestOtp(phoneE164) {
  try {
    const res = await client.send(
      new InitiateAuthCommand({ AuthFlow: "CUSTOM_AUTH", ClientId, AuthParameters: { USERNAME: phoneE164 } })
    );
    return res.Session; // pass this to verifyOtp
  } catch (e) {
    if (e.name === "UserNotFoundException") {
      await client.send(
        new SignUpCommand({
          ClientId,
          Username: phoneE164,
          Password: crypto.randomUUID() + "Aa1!", // never used again; custom auth bypasses passwords
          UserAttributes: [{ Name: "phone_number", Value: phoneE164 }],
        })
      );
      return requestOtp(phoneE164); // PreSignUp trigger auto-confirms, so this retry succeeds
    }
    throw e;
  }
}

export async function verifyOtp(phoneE164, otp, session) {
  const res = await client.send(
    new RespondToAuthChallengeCommand({
      ClientId,
      ChallengeName: "CUSTOM_CHALLENGE",
      Session: session,
      ChallengeResponses: { USERNAME: phoneE164, ANSWER: otp },
    })
  );
  if (!res.AuthenticationResult) throw new Error("Incorrect OTP");
  return res.AuthenticationResult; // { IdToken, AccessToken, RefreshToken }
}

// Exchanges a still-valid RefreshToken for a new IdToken/AccessToken, silently — no OTP
// involved. Cognito does not issue a new RefreshToken here by default, so the caller
// keeps reusing the original one until it expires (30 days by default for this pool).
export async function refreshTokens(refreshToken) {
  const res = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    })
  );
  if (!res.AuthenticationResult) throw new Error("Refresh failed");
  return res.AuthenticationResult; // { IdToken, AccessToken }
}
