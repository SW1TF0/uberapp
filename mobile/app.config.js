module.exports = {
  expo: {
    name: 'Kardzhali Ride',
    slug: 'kardzhali-ride',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    scheme: 'kardzhaliride',
    assetBundlePatterns: ['**/*'],
    icon: './assets/icon.png',
    backgroundColor: '#160B0D',
    ios: {
      supportsTablet: false,
      icon: './assets/icon.png',
      bundleIdentifier: 'com.kardzhaliride.app',
      // Locally, EAS Build reads the file straight off disk. In the cloud
      // (where the repo's gitignored config files don't exist), it's
      // instead injected as a "file" type environment variable — see
      // README.md's EAS setup notes.
      googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Kardzhali Ride се нуждае от местоположението ти, за да намери близки шофьори и да зададе точка за качване.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Kardzhali Ride споделя местоположението ти с пътниците, докато си онлайн като шофьор.',
        UIBackgroundModes: ['location'],
        NSPhotoLibraryUsageDescription:
          'Kardzhali Ride се нуждае от достъп до снимките ти, за да зададеш профилна снимка.',
      },
    },
    android: {
      package: 'com.kardzhaliride.app',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon-foreground.png',
        backgroundColor: '#A11D2E',
      },
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
      ],
    },
    plugins: [
      '@react-native-firebase/app',
      ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Kardzhali Ride споделя местоположението ти с пътниците, докато си онлайн като шофьор.',
          isIosBackgroundLocationEnabled: true,
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          backgroundColor: '#160B0D',
          resizeMode: 'contain',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Kardzhali Ride се нуждае от достъп до снимките ти, за да зададеш профилна снимка.',
        },
      ],
      [
        '@stripe/stripe-react-native',
        {
          enableGooglePay: false,
        },
      ],
    ],
    extra: {
      // The Stripe PUBLISHABLE key is not secret — it's meant to ship
      // inside client apps (see README's Stripe setup section) — so
      // unlike the google-services files it's just a plain env var, no
      // "file" secret upload needed.
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
      eas: {
        projectId: '6339be96-12b0-4f99-8315-9a42066ebd98',
      },
    },
  },
};
