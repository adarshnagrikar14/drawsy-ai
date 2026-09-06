import clsx from "clsx";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { useCallback, useState } from "react";

import { useEditorInterface, useExcalidrawContainer } from "../App";
import { Island } from "../Island";
import Stack from "../Stack";

const BASE_ALIGN_OFFSET = -4;
const BASE_SIDE_OFFSET = 10;

const isNestedPopupTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest("[data-prevent-outside-click]"));

const DropdownMenuSubContent = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const editorInterface = useEditorInterface();
  const { container } = useExcalidrawContainer();

  const classNames = clsx(`dropdown-menu dropdown-submenu ${className}`, {
    "dropdown-menu--mobile": editorInterface.formFactor === "phone",
  }).trim();

  const callbacksRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        return;
      }

      const parentContainer = node.closest(".dropdown-menu-container");
      const parentRect = parentContainer?.getBoundingClientRect();
      const menuWidth = node.getBoundingClientRect().width;

      const boundaryRect = container?.getBoundingClientRect();
      const boundaryRight = boundaryRect?.right ?? window.innerWidth;
      const spaceRemaining = parentRect
        ? boundaryRight - parentRect.right
        : Number.POSITIVE_INFINITY;
      const needsLeftPlacement = spaceRemaining < menuWidth + 20;

      setSideOffset(
        needsLeftPlacement
          ? spaceRemaining - menuWidth + BASE_ALIGN_OFFSET
          : BASE_SIDE_OFFSET,
      );
      setAlignOffset(
        needsLeftPlacement ? BASE_ALIGN_OFFSET + 8 : BASE_ALIGN_OFFSET,
      );
    },
    [container],
  );

  const handleNestedPopupPointerDownOutside = useCallback((event: Event) => {
    if (isNestedPopupTarget(event.target)) {
      event.preventDefault();
    }
  }, []);

  const handleNestedPopupFocusOutside = useCallback((event: Event) => {
    if (isNestedPopupTarget(event.target)) {
      event.preventDefault();
    }
  }, []);

  const [sideOffset, setSideOffset] = useState(BASE_SIDE_OFFSET);
  const [alignOffset, setAlignOffset] = useState(BASE_ALIGN_OFFSET);

  return (
    <DropdownMenuPrimitive.SubContent
      className={classNames}
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      collisionPadding={8}
      collisionBoundary={container ?? undefined}
      ref={callbacksRef}
      onPointerDownOutside={handleNestedPopupPointerDownOutside}
      onFocusOutside={handleNestedPopupFocusOutside}
    >
      {editorInterface.formFactor === "phone" ? (
        <Stack.Col className="dropdown-menu-container">{children}</Stack.Col>
      ) : (
        <Island
          className="dropdown-menu-container"
          padding={2}
          style={{ zIndex: 1 }}
        >
          {children}
        </Island>
      )}
    </DropdownMenuPrimitive.SubContent>
  );
};

export default DropdownMenuSubContent;
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
