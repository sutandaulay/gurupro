import { RootLayout } from "@payloadcms/next/layouts";
import config from "@payload-config";
import { importMap } from "./importMap";
import { payloadServerFunction } from "./serverFunction";
import "@payloadcms/next/css";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <RootLayout
      config={config}
      importMap={importMap}
      serverFunction={payloadServerFunction}
    >
      {children}
    </RootLayout>
  );
};

export default Layout;
