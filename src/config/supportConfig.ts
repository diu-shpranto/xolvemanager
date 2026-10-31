export interface SupportConfig {
  supportEmail: string | null;
  facebookPageUrl: string | null;
  messengerUrl: string | null;
  documentationUrl: string | null;
  feedbackEnabled: boolean;
}

export const supportConfig: SupportConfig = {
  supportEmail: null,
  facebookPageUrl: null,
  messengerUrl: null,
  documentationUrl: '/legal',
  feedbackEnabled: false,
};
