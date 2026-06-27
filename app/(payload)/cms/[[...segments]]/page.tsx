import config from "@payload-config";
import { RootPage } from "@payloadcms/next/views";
import { importMap } from "../../importMap";

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

const AdminPage = ({ params, searchParams }: Args) => {
  return RootPage({
    config,
    importMap,
    params,
    searchParams,
  });
};

export default AdminPage;
