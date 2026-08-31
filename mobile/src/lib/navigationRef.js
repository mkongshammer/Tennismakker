// Global navigationsreference.
//
// Profilen skal kunne åbnes fra et hjørne-ikon på alle fire faner — men
// hver fane har sin egen indlejrede stak (Tabs -> Stack -> Skærm), så at
// "gå to niveauer op" med getParent() bliver skrøbeligt at vedligeholde.
// I stedet navigerer vi via en reference til selve NavigationContainer,
// som virker ens uanset hvor dybt man er nede i en given fane.
import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

export function openProfile() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Profil");
  }
}
