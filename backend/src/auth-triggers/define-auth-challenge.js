export const handler = async (event) => {
  const session = event.request.session;
  if (session.length === 0) {
    Object.assign(event.response, { issueTokens: false, failAuthentication: false, challengeName: "CUSTOM_CHALLENGE" });
  } else if (session.length >= 1 && session.slice(-1)[0].challengeResult === true) {
    Object.assign(event.response, { issueTokens: true, failAuthentication: false });
  } else if (session.length >= 3) {
    Object.assign(event.response, { issueTokens: false, failAuthentication: true }); // 3 wrong OTPs = fail
  } else {
    Object.assign(event.response, { issueTokens: false, failAuthentication: false, challengeName: "CUSTOM_CHALLENGE" });
  }
  return event;
};
