import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("ui-test", "routes/ui-test.tsx")
] satisfies RouteConfig;
