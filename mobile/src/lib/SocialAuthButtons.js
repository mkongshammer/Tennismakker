import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin, GoogleSigninButton } from "@react-native-google-signin/google-signin";

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? Constants.expoConfig?.extra?.googleWebClientId;

export function SocialAuthButtons({ disabled, onCredential, onError }) {
  useEffect(() => {
    if (Platform.OS === "android" && googleWebClientId) {
      GoogleSignin.configure({ webClientId: googleWebClientId, offlineAccess: false });
    }
  }, []);

  if (Platform.OS === "web") return null;

  const google = async () => {
    try {
      if (!googleWebClientId) throw new Error("Google-login mangler den endelige Google Client ID-konfiguration.");
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const data = response?.data ?? response;
      const idToken = data?.idToken;
      if (!idToken) throw new Error("Google returnerede ikke et sikkert login-token. Prøv igen.");
      const user = data?.user ?? {};
      await onCredential({ provider: "google", idToken, name: user.name ?? "" });
    } catch (error) {
      if (["SIGN_IN_CANCELLED", "12501"].includes(String(error?.code ?? ""))) return;
      onError?.(error);
    }
  };

  const apple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("Apple returnerede ikke et sikkert login-token. Prøv igen.");
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ");
      await onCredential({ provider: "apple", idToken: credential.identityToken, name });
    } catch (error) {
      if (String(error?.code ?? "") === "ERR_REQUEST_CANCELED") return;
      onError?.(error);
    }
  };

  return (
    <View style={{ gap: 10, width: "100%" }}>
      {Platform.OS === "android" && (
        <GoogleSigninButton
          style={{ width: "100%", height: 52 }}
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Light}
          disabled={disabled}
          onPress={google}
        />
      )}
      {Platform.OS === "ios" && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={14}
          style={{ width: "100%", height: 52, opacity: disabled ? 0.55 : 1 }}
          onPress={disabled ? undefined : apple}
        />
      )}
    </View>
  );
}
