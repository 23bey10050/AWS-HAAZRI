import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
const sns = new SNSClient({});

export const handler = async (event) => {
  let otp;
  if (event.request.session.length === 0) {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
    await sns.send(
      new PublishCommand({
        PhoneNumber: event.request.userAttributes.phone_number,
        Message: `Your Haazri OTP is ${otp}. Valid 5 minutes. Do not share it.`,
      })
    );
  } else {
    // Re-prompt within the same session (e.g. UI retry) — do not resend a new SMS.
    const prev = event.request.session.slice(-1)[0];
    otp = prev.challengeMetadata?.replace("OTP-", "");
  }
  event.response.publicChallengeParameters = { phone: event.request.userAttributes.phone_number };
  event.response.privateChallengeParameters = { otp };
  event.response.challengeMetadata = `OTP-${otp}`;
  return event;
};
