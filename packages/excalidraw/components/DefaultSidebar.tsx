import clsx from "clsx";

import {
  CANVAS_SEARCH_TAB,
  DEFAULT_SIDEBAR,
  LIBRARY_SIDEBAR_TAB,
  composeEventHandlers,
} from "@excalidraw/common";

import type { MarkOptional, Merge } from "@excalidraw/common/utility-types";

import { useTunnels } from "../context/tunnels";
import { useUIAppState } from "../context/ui-appState";

import "../components/dropdownMenu/DropdownMenu.scss";

import { useExcalidrawSetAppState } from "./App";
import { LibraryMenu } from "./LibraryMenu";
import { SearchMenu } from "./SearchMenu";
import { Sidebar } from "./Sidebar/Sidebar";
import { withInternalFallback } from "./hoc/withInternalFallback";
import { LibraryIcon, searchIcon } from "./icons";

import type { SidebarProps, SidebarTriggerProps } from "./Sidebar/common";

const TAB_TITLES: Record<string, string> = {
  [CANVAS_SEARCH_TAB]: "Search",
  [LIBRARY_SIDEBAR_TAB]: "Library",
  comments: "Comments",
  presentation: "Presentation",
};

const DefaultSidebarTrigger = withInternalFallback(
  "DefaultSidebarTrigger",
  (
    props: Omit<SidebarTriggerProps, "name"> &
      React.HTMLAttributes<HTMLDivElement>,
  ) => {
    const { DefaultSidebarTriggerTunnel } = useTunnels();
    return (
      <DefaultSidebarTriggerTunnel.In>
        <Sidebar.Trigger
          {...props}
          className="default-sidebar-trigger"
          name={DEFAULT_SIDEBAR.name}
        />
      </DefaultSidebarTriggerTunnel.In>
    );
  },
);
DefaultSidebarTrigger.displayName = "DefaultSidebarTrigger";

const DefaultTabTriggers = ({ children }: { children: React.ReactNode }) => {
  const { DefaultSidebarTabTriggersTunnel } = useTunnels();
  return (
    <DefaultSidebarTabTriggersTunnel.In>
      {children}
    </DefaultSidebarTabTriggersTunnel.In>
  );
};
DefaultTabTriggers.displayName = "DefaultTabTriggers";

export const DefaultSidebar = Object.assign(
  withInternalFallback(
    "DefaultSidebar",
    ({
      children,
      className,
      onDock,
      docked,
      ...rest
    }: Merge<
      MarkOptional<Omit<SidebarProps, "name">, "children">,
      {
        /** pass `false` to disable docking */
        onDock?: SidebarProps["onDock"] | false;
      }
    >) => {
      const appState = useUIAppState();
      const setAppState = useExcalidrawSetAppState();

      const { DefaultSidebarTabTriggersTunnel } = useTunnels();

      const activeTab = appState?.openSidebar?.tab ?? "";
      const tabTitle = TAB_TITLES[activeTab] ?? "";

      return (
        <Sidebar
          {...rest}
          name="default"
          key="default"
          className={clsx("default-sidebar", className)}
          docked={
            docked ?? appState?.defaultSidebarDockedPreference
          }
          onDock={
            onDock === false
              ? undefined
              : composeEventHandlers(onDock, (docked) => {
                  setAppState({ defaultSidebarDockedPreference: docked });
                })
          }
        >
          <Sidebar.Tabs>
            <Sidebar.Header>
              {tabTitle && (
                <span className="default-sidebar-tab-title">{tabTitle}</span>
              )}
              <Sidebar.TabTriggers>
                <Sidebar.TabTrigger tab={CANVAS_SEARCH_TAB}>
                  {searchIcon}
                </Sidebar.TabTrigger>
                <Sidebar.TabTrigger tab={LIBRARY_SIDEBAR_TAB}>
                  {LibraryIcon}
                </Sidebar.TabTrigger>
                <DefaultSidebarTabTriggersTunnel.Out />
              </Sidebar.TabTriggers>
            </Sidebar.Header>
            <Sidebar.Tab tab={LIBRARY_SIDEBAR_TAB}>
              <LibraryMenu />
            </Sidebar.Tab>
            <Sidebar.Tab tab={CANVAS_SEARCH_TAB}>
              <SearchMenu />
            </Sidebar.Tab>
            {children}
          </Sidebar.Tabs>
        </Sidebar>
      );
    },
  ),
  {
    Trigger: DefaultSidebarTrigger,
    TabTriggers: DefaultTabTriggers,
  },
);
