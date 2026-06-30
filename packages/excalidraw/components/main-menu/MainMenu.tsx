import React from "react";

import { composeEventHandlers } from "@excalidraw/common";

import { useTunnels } from "../../context/tunnels";
import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";
import { useEditorInterface, useExcalidrawSetAppState } from "../App";
import { UserList } from "../UserList";
import DropdownMenu from "../dropdownMenu/DropdownMenu";
import DropdownMenuSub from "../dropdownMenu/DropdownMenuSub";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { HamburgerMenuIcon, PlusIcon } from "../icons";

import * as DefaultItems from "./DefaultItems";

const MainMenu = Object.assign(
  withInternalFallback(
    "MainMenu",
    ({
      children,
      onSelect,
      addMenu,
      header,
    }: {
      children?: React.ReactNode;
      /**
       * Called when any menu item is selected (clicked on).
       */
      onSelect?: (event: Event) => void;
      addMenu?: React.ReactNode;
      header?: React.ReactNode;
    }) => {
      const { MainMenuTunnel } = useTunnels();
      const editorInterface = useEditorInterface();
      const appState = useUIAppState();
      const setAppState = useExcalidrawSetAppState();
      const addMenuCloseTimer = React.useRef<number | null>(null);

      const clearAddMenuCloseTimer = React.useCallback(() => {
        if (addMenuCloseTimer.current !== null) {
          window.clearTimeout(addMenuCloseTimer.current);
          addMenuCloseTimer.current = null;
        }
      }, []);

      const openAddMenu = React.useCallback(() => {
        clearAddMenuCloseTimer();
        if (appState.openMenu !== "add") {
          setAppState({
            openMenu: "add",
            openPopup: null,
            openDialog: null,
          });
        }
      }, [appState.openMenu, clearAddMenuCloseTimer, setAppState]);

      const scheduleAddMenuClose = React.useCallback(() => {
        clearAddMenuCloseTimer();
        addMenuCloseTimer.current = window.setTimeout(() => {
          setAppState({ openMenu: null });
        }, 140);
      }, [clearAddMenuCloseTimer, setAppState]);

      React.useEffect(
        () => () => {
          clearAddMenuCloseTimer();
        },
        [clearAddMenuCloseTimer],
      );

      React.useEffect(() => {
        if (appState.openMenu !== "add") {
          return;
        }

        const onMouseMove = (event: MouseEvent) => {
          const target = event.target;
          if (!(target instanceof Node)) {
            return;
          }

          const trigger = document.querySelector(
            '[data-testid="add-menu-trigger"]',
          );
          const menu = document.querySelector(".add-menu");

          if (trigger?.contains(target) || menu?.contains(target)) {
            clearAddMenuCloseTimer();
          } else if (addMenuCloseTimer.current === null) {
            scheduleAddMenuClose();
          }
        };

        document.addEventListener("mousemove", onMouseMove);
        return () => document.removeEventListener("mousemove", onMouseMove);
      }, [appState.openMenu, clearAddMenuCloseTimer, scheduleAddMenuClose]);

      return (
        <MainMenuTunnel.In>
          <div className="main-menu-trigger-group">
            <DropdownMenu open={appState.openMenu === "canvas"}>
              <DropdownMenu.Trigger
                onToggle={() => {
                  clearAddMenuCloseTimer();
                  setAppState({
                    openMenu: appState.openMenu === "canvas" ? null : "canvas",
                    openPopup: null,
                    openDialog: null,
                  });
                }}
                data-testid="main-menu-trigger"
                className="main-menu-trigger"
              >
                {HamburgerMenuIcon}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                onClickOutside={() => setAppState({ openMenu: null })}
                onSelect={composeEventHandlers(onSelect, () => {
                  setAppState({ openMenu: null });
                })}
                className="main-menu"
                align="start"
              >
                {children}
                {editorInterface.formFactor === "phone" &&
                  appState.collaborators.size > 0 && (
                    <fieldset className="UserList-Wrapper">
                      <legend>{t("labels.collaborators")}</legend>
                      <UserList
                        mobile={true}
                        collaborators={appState.collaborators}
                        userToFollow={appState.userToFollow?.socketId || null}
                      />
                    </fieldset>
                  )}
              </DropdownMenu.Content>
            </DropdownMenu>
            <DropdownMenu open={appState.openMenu === "add"}>
              <DropdownMenu.Trigger
                onToggle={() => {
                  setAppState({
                    openMenu: appState.openMenu === "add" ? null : "add",
                    openPopup: null,
                    openDialog: null,
                  });
                }}
                data-testid="add-menu-trigger"
                className="main-menu-trigger main-menu-add-button"
                aria-label="Add"
                title="Add"
                onMouseEnter={openAddMenu}
                onMouseLeave={scheduleAddMenuClose}
              >
                {PlusIcon}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                onClickOutside={() => setAppState({ openMenu: null })}
                className="add-menu"
                align="start"
              >
                {addMenu ||
                  Array.from({ length: 5 }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      className="add-menu-card"
                      aria-label={`Add option ${index + 1}`}
                    />
                  ))}
              </DropdownMenu.Content>
            </DropdownMenu>
            {header}
          </div>
        </MainMenuTunnel.In>
      );
    },
  ),
  {
    Trigger: DropdownMenu.Trigger,
    Item: DropdownMenu.Item,
    ItemLink: DropdownMenu.ItemLink,
    ItemCustom: DropdownMenu.ItemCustom,
    Group: DropdownMenu.Group,
    Separator: DropdownMenu.Separator,
    Sub: DropdownMenuSub,
    DefaultItems,
  },
);

export default MainMenu;
