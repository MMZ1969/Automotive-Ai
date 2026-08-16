import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

export default function InviteRedirect() {
  const { code } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    router.replace({ pathname: "/(auth)/register", params: { code } });
  }, [code]);

  return null;
}