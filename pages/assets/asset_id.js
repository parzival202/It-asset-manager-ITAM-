import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AssetIdPlaceholder() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/assets");
  }, [router]);

  return null;
}
