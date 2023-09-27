interface InitParams{
  appName: string;
  reportUrl: string;
  appVersion?: string;
  ipUrl?: string;
  debug?: boolean;
  userId?: string;
  [string: string]: any;
}

export {
  InitParams
}