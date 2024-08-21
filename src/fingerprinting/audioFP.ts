import md5 from 'blueimp-md5';

export default async function () {
  return await new Promise((resolve, reject) => {
    const options = {
      EXCLUDED: 'excluded',
      NOT_AVAILABLE: 'NotAvailable',
      audio: {
        timeout: 1000,
        // On iOS 11, audio context can only be used in response to user interaction.
        // We require users to explicitly enable audio fingerprinting on iOS 11.
        // See https://stackoverflow.com/questions/46363048/onaudioprocess-not-called-on-ios11#46534088
        excludeIOS11: true,
      },
    };

    const audioOptions = options.audio;
    if (audioOptions.excludeIOS11 && navigator.userAgent.match(/OS 11.+Version\/11.+Safari/)) {
      // See comment for excludeUserAgent and https://stackoverflow.com/questions/46363048/onaudioprocess-not-called-on-ios11#46534088
      resolve(options.EXCLUDED); return;
    }

    const AudioContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;

    if (AudioContext == null) {
      resolve(options.NOT_AVAILABLE); return;
    }

    let context: any = new AudioContext(1, 44100, 44100);

    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, context.currentTime);

    const compressor: any = context.createDynamicsCompressor();
    [
      ['threshold', -50],
      ['knee', 40],
      ['ratio', 12],
      ['reduction', -20],
      ['attack', 0],
      ['release', 0.25],
    ].forEach(function (item) {
      if (
        compressor[item[0]] !== undefined &&
        typeof compressor[item[0]].setValueAtTime === 'function'
      ) {
        compressor[item[0]].setValueAtTime(item[1], context.currentTime);
      }
    });

    oscillator.connect(compressor);
    compressor.connect(context.destination);
    oscillator.start(0);
    context.startRendering();

    const audioTimeoutId = setTimeout(function () {
      console.warn(
        'Audio fingerprint timed out. Please report bug at https://github.com/Valve/fingerprintjs2 with your user agent: "' +
          navigator.userAgent +
          '".'
      );
      context.oncomplete = function () {};
      context = null;
      resolve('audioTimeout');
    }, audioOptions.timeout);

    context.oncomplete = function (event: any) {
      let fingerprint;
      try {
        clearTimeout(audioTimeoutId);
        fingerprint = event.renderedBuffer
          .getChannelData(0)
          .slice(4500, 5000)
          .reduce(function (acc: any, val: any) {
            return acc + Math.abs(val);
          }, 0)
          .toString();
        oscillator.disconnect();
        compressor.disconnect();
      } catch (error) {
        resolve(error);
        return;
      }
      resolve(fingerprint);
    };
  }).then((rawData: any) => {
    return {
      hash: md5(rawData + ''),
      rawData,
    };
  });
}
