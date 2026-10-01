import {tr} from "./international";
import { Alert, Platform } from "react-native";

// React Native Web does not implement Alert.alert.
export const feedback = {
  alert(title, message, buttons) {
    title=tr(title);message=tr(message);buttons=buttons?.map(button=>({...button,text:tr(button.text)}));
    if (Platform.OS !== "web") return Alert.alert(title, message, buttons);
    if (buttons?.length) {
      if (window.confirm(`${title}\n\n${message}`)) {
        buttons.find((button) => button.style !== "cancel")?.onPress?.();
      }
    } else {
      window.alert(`${title}\n\n${message ?? ""}`);
    }
  },
};
