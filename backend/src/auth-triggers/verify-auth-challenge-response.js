export const handler = async (event) => {
  event.response.answerCorrect =
    event.request.privateChallengeParameters.otp === event.request.challengeAnswer;
  return event;
};
