import clsx from "clsx";

import { useTunnels } from "../../context/tunnels";
import { ExitZenModeButton, UndoRedoActions, ZoomActions } from "../Actions";
import { Section } from "../Section";
import Stack from "../Stack";

import type { ActionManager } from "../../actions/manager";
import type { UIAppState } from "../../types";

const Footer = ({
  appState,
  actionManager,
  showExitZenModeBtn,
  renderWelcomeScreen,
}: {
  appState: UIAppState;
  actionManager: ActionManager;
  showExitZenModeBtn: boolean;
  renderWelcomeScreen: boolean;
}) => {
  const { FooterCenterTunnel } = useTunnels();

  return (
    <footer
      role="contentinfo"
      className="layer-ui__wrapper__footer App-menu App-menu_bottom"
    >
      <div
        className={clsx("layer-ui__wrapper__footer-left zen-mode-transition", {
          "layer-ui__wrapper__footer-left--transition-left":
            appState.zenModeEnabled,
        })}
      >
        <Stack.Col gap={2}>
          <Section heading="canvasActions" />
        </Stack.Col>
      </div>
      <FooterCenterTunnel.Out />
      <div
        className={clsx("layer-ui__wrapper__footer-right zen-mode-transition", {
          "transition-right": appState.zenModeEnabled,
        })}
      >
        <Stack.Col gap={2}>
          <Section heading="canvasActions">
            <ZoomActions
              renderAction={actionManager.renderAction}
              zoom={appState.zoom}
            />

            {!appState.viewModeEnabled && (
              <UndoRedoActions
                renderAction={actionManager.renderAction}
                className={clsx("zen-mode-transition", {
                  "layer-ui__wrapper__footer-left--transition-bottom":
                    appState.zenModeEnabled,
                })}
              />
            )}
          </Section>
        </Stack.Col>
      </div>
      <ExitZenModeButton
        actionManager={actionManager}
        showExitZenModeBtn={showExitZenModeBtn}
      />
    </footer>
  );
};

export default Footer;
Footer.displayName = "Footer";
