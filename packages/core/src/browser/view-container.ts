/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { interfaces } from 'inversify';
import { v4 } from 'uuid';
import { IIterator, map, toArray, find, some, every } from '@phosphor/algorithm';
import {
    Widget, EXPANSION_TOGGLE_CLASS, COLLAPSED_CLASS, MessageLoop, Message, SplitPanel, BaseWidget,
    addEventListener, SplitLayout
} from './widgets';
import { Event, Emitter } from '../common/event';
import { Disposable, DisposableCollection } from '../common/disposable';
import { CommandRegistry } from '../common/command';
import { MenuModelRegistry, MenuPath } from '../common/menu';
import { ContextMenuRenderer, Anchor } from './context-menu-renderer';
import { ApplicationShell, StatefulWidget, SplitPositionHandler } from './shell';
import { ViewContainerLayout } from './view-container-layout';
import { WidgetManager } from './widget-manager';

export class ViewContainer extends BaseWidget implements StatefulWidget, ApplicationShell.TrackableWidgetProvider {

    protected readonly panel: SplitPanel;

    constructor(protected readonly services: ViewContainer.Services, ...inputs: { widget: Widget, options?: ViewContainer.Factory.WidgetOptions }[]) {
        super();
        this.id = `view-container-widget-${v4()}`;
        this.addClass('theia-view-container');
        const layout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            spacing: 2,
            orientation: this.orientation,
            isCollapsed: (part: ViewContainerPart) => part.collapsed,
            minHeight: (part: ViewContainerPart) => part.options.minHeight
        }, services.splitPositionHandler);
        this.panel = new SplitPanel({ layout });
        this.panel.addClass('split-panel');
        for (const { widget, options } of inputs) {
            this.addWidget(widget, options);
        }

        const { commandRegistry, menuRegistry, contextMenuRenderer } = this.services;
        commandRegistry.registerCommand({ id: this.globalHideCommandId }, {
            execute: (anchor: Anchor) => {
                const { x, y } = anchor;
                const element = document.elementFromPoint(x, y);
                if (element instanceof Element) {
                    const closestPart = ViewContainerPart.closestPart(element);
                    if (closestPart && closestPart.id) {
                        const toHide = find(this.parts, part => part.id === closestPart.id);
                        if (toHide) {
                            this.toggleVisibility(toHide);
                        }
                    }
                }
            },
            isVisible: () => some(this.parts, part => !part.isHidden)
        });
        menuRegistry.registerMenuAction([...this.contextMenuPath, '0_global'], {
            commandId: this.globalHideCommandId,
            label: 'Hide'
        });
        this.toDispose.pushAll([
            addEventListener(this.node, 'contextmenu', event => {
                if (event.button === 2 && every(this.parts, part => !!part.isHidden)) {
                    event.stopPropagation();
                    event.preventDefault();
                    contextMenuRenderer.render({ menuPath: this.contextMenuPath, anchor: event });
                }
            }),
            Disposable.create(() => commandRegistry.unregisterCommand(this.globalHideCommandId)),
            Disposable.create(() => menuRegistry.unregisterMenuAction(this.globalHideCommandId))
        ]);
    }

    addWidget(widget: Widget, options?: ViewContainer.Factory.WidgetOptions): Disposable {
        if (find(this.parts, ({ wrapped }) => wrapped.id === widget.id)) {
            return Disposable.NULL;
        }
        const description = this.services.widgetManager.getDescription(widget);
        const partId = description ? JSON.stringify(description) : widget.id;
        const newPart = new ViewContainerPart(widget, partId, this.id, options);
        this.registerPart(newPart);
        this.layout.addWidget(newPart);
        this.update();
        return new DisposableCollection(
            Disposable.create(() => this.removeWidget(widget)),
            newPart.onCollapsed(() => this.toggleCollapsed(newPart)),
            newPart.onMoveBefore(toMoveId => this.moveBefore(toMoveId, newPart.id)),
            newPart.onContextMenu(event => {
                if (event.button === 2) {
                    event.preventDefault();
                    event.stopPropagation();
                    const { contextMenuRenderer } = this.services;
                    contextMenuRenderer.render({ menuPath: this.contextMenuPath, anchor: event });
                }
            })
        );
    }

    removeWidget(widget: Widget): boolean {
        const part = find(this.parts, ({ wrapped }) => wrapped.id === widget.id);
        if (!part) {
            return false;
        }
        this.unregisterPart(part);
        this.layout.removeWidget(part);
        this.update();
        return true;
    }

    getTrackableWidgets(): ViewContainerPart[] {
        return toArray(this.parts);
    }

    get layout(): ViewContainerLayout {
        return this.panel.layout as ViewContainerLayout;
    }

    storeState(): ViewContainer.State {
        const parts = toArray(map(this.parts, part => <ViewContainerPart.State>{
            partId: part.partId,
            hidden: part.isHidden
        }));
        return { parts };
    }

    restoreState(state: ViewContainer.State): void {
        if (state.parts) {
            // Reorder the parts according to the stored state
            let index = 0;
            for (const partState of state.parts) {
                const currentIndex = this.getTrackableWidgets().findIndex(p => p.partId === partState.partId);
                if (currentIndex >= 0) {
                    if (currentIndex > index) {
                        this.layout.moveWidget(currentIndex, index);
                    }
                    index++;
                }
            }

            // Restore visibility state
            const currentParts = this.getTrackableWidgets();
            for (const partState of state.parts) {
                const part = currentParts.find(p => p.partId === partState.partId);
                if (part) {
                    part.setHidden(partState.hidden);
                }
            }
        }
    }

    protected registerPart(toRegister: ViewContainerPart): void {
        const { commandRegistry, menuRegistry } = this.services;
        const commandId = this.toggleVisibilityCommandId(toRegister);
        commandRegistry.registerCommand({ id: commandId }, {
            execute: () => {
                const toHide = find(this.parts, part => part.id === toRegister.id);
                if (toHide) {
                    this.toggleVisibility(toHide);
                }
            },
            isToggled: () => {
                const widgetToToggle = find(this.parts, part => part.id === toRegister.id);
                if (widgetToToggle) {
                    return !widgetToToggle.isHidden;
                }
                return false;
            }
        });
        menuRegistry.registerMenuAction([...this.contextMenuPath, '1_widgets'], {
            commandId: commandId,
            label: toRegister.wrapped.title.label
            // order: TODO: the order should be based on the part order.
        });
    }

    protected unregisterPart(part: ViewContainerPart): void {
        const { commandRegistry, menuRegistry } = this.services;
        const commandId = this.toggleVisibilityCommandId(part);
        commandRegistry.unregisterCommand(commandId);
        menuRegistry.unregisterMenuAction(commandId);
    }

    protected toggleVisibility(part: ViewContainerPart): void {
        part.setHidden(!part.isHidden);
    }

    protected toggleCollapsed(part: ViewContainerPart): void {
        const parts = this.getTrackableWidgets();
        const index = parts.indexOf(part);
        if (index >= 0) {
            this.layout.toggleCollapsed(index);
        }
    }

    protected moveBefore(toMovedId: string, moveBeforeThisId: string): void {
        const parts = this.getTrackableWidgets();
        const toMoveIndex = parts.findIndex(part => part.id === toMovedId);
        const moveBeforeThisIndex = parts.findIndex(part => part.id === moveBeforeThisId);
        if (toMoveIndex >= 0 && moveBeforeThisIndex >= 0) {
            this.layout.moveWidget(toMoveIndex, moveBeforeThisIndex);
        }
    }

    protected onResize(msg: Widget.ResizeMessage): void {
        for (const widget of [this.panel, ...this.getTrackableWidgets()]) {
            MessageLoop.sendMessage(widget, Widget.ResizeMessage.UnknownSize);
        }
        super.onResize(msg);
    }

    protected onUpdateRequest(msg: Message): void {
        for (const widget of [this.panel, ...this.getTrackableWidgets()]) {
            widget.update();
        }
        super.onUpdateRequest(msg);
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.panel.activate();
    }

    protected onAfterAttach(msg: Message): void {
        if (this.panel.isAttached) {
            Widget.detach(this.panel);
        }
        this.layout.orientation = this.orientation;
        Widget.attach(this.panel, this.node);
        super.onAfterAttach(msg);
    }

    protected get orientation(): SplitLayout.Orientation {
        if (this.node.closest('#theia-main-content-panel') || this.node.closest('#theia-bottom-content-panel')) {
            return 'horizontal';
        }
        return 'vertical';
    }

    /**
     * Sugar for `this.layout.iter()`.
     *
     * Returns with the parts, **not** the `wrapped`, original widgets.
     */
    protected get parts(): IIterator<ViewContainerPart> {
        return this.layout.iter() as IIterator<ViewContainerPart>;
    }

    protected get contextMenuPath(): MenuPath {
        return [`${this.id}-context-menu`];
    }

    protected toggleVisibilityCommandId(part: ViewContainerPart): string {
        return `${this.id}:toggle-visibility-${part.id}`;
    }

    protected get globalHideCommandId(): string {
        return `${this.id}:toggle-visibility`;
    }

}

export namespace ViewContainer {

    export interface Services {
        readonly contextMenuRenderer: ContextMenuRenderer;
        readonly commandRegistry: CommandRegistry;
        readonly menuRegistry: MenuModelRegistry;
        readonly widgetManager: WidgetManager;
        readonly splitPositionHandler: SplitPositionHandler;
    }

    export const Factory = Symbol('ViewContainerFactory');
    export interface Factory {
        (...widgets: Factory.WidgetDescriptor[]): ViewContainer;
    }

    export interface State {
        parts: ViewContainerPart.State[]
    }

    export namespace Factory {

        export interface WidgetOptions {
            readonly order?: number; // TODO consider

            readonly weight?: number; // TODO consider

            readonly minHeight?: number;

            readonly collapsed?: boolean;

            readonly canToggleVisibility?: boolean; // TODO consider

            // Applies only to newly created views
            readonly hideByDefault?: boolean; // TODO consider
        }

        export interface WidgetDescriptor {
            // tslint:disable-next-line:no-any
            readonly widget: Widget | interfaces.ServiceIdentifier<Widget>;

            readonly options?: WidgetOptions;
        }

    }
}

export class ViewContainerPart extends BaseWidget {

    protected readonly header: HTMLElement;
    protected readonly body: HTMLElement;
    protected readonly collapsedEmitter = new Emitter<boolean>();
    protected readonly moveBeforeEmitter = new Emitter<string>();
    protected readonly contextMenuEmitter = new Emitter<MouseEvent>();

    protected _collapsed: boolean;
    /**
     * Self cannot be a drop target. When the drag event starts, we disable the current part as a possible drop target.
     *
     * This is a workaround for not being able to sniff into the `event.dataTransfer.getData` value when `dragover` due to security reasons.
     */
    protected canBeDropTarget = true;

    constructor(
        public readonly wrapped: Widget,
        public readonly partId: string,
        viewContainerId: string,
        public readonly options: ViewContainer.Factory.WidgetOptions = {}) {

        super();
        this.id = `${viewContainerId}--${wrapped.id}`;
        this.addClass('part');
        this._collapsed = !!options.collapsed;
        const { header, body, disposable } = this.createContent();
        this.header = header;
        this.body = body;
        this.toDispose.pushAll([
            disposable,
            this.collapsedEmitter,
            this.moveBeforeEmitter,
            this.contextMenuEmitter,
            this.registerDND(),
            this.registerContextMenu()
        ]);
        this.scrollOptions = {
            suppressScrollX: true,
            minScrollbarLength: 35 // TODO: Adjust this?
        };
        this.node.tabIndex = 0;
        if (this._collapsed) {
            this.collapsedEmitter.fire(true);
        }
    }

    get collapsed(): boolean {
        return this._collapsed;
    }

    get onCollapsed(): Event<boolean> {
        return this.collapsedEmitter.event;
    }

    get onMoveBefore(): Event<string> {
        return this.moveBeforeEmitter.event;
    }

    get onContextMenu(): Event<MouseEvent> {
        return this.contextMenuEmitter.event;
    }

    protected getScrollContainer(): HTMLElement {
        return this.body;
    }

    protected registerContextMenu(): Disposable {
        return new DisposableCollection(
            addEventListener(this.header, 'contextmenu', event => {
                this.contextMenuEmitter.fire(event);
            })
        );
    }

    protected registerDND(): Disposable {
        this.header.draggable = true;
        const style = (event: DragEvent) => {
            event.preventDefault();
            const part = ViewContainerPart.closestPart(event.target);
            if (part instanceof HTMLElement) {
                if (this.canBeDropTarget) {
                    part.classList.add('drop-target');
                }
            }
        };
        const unstyle = (event: DragEvent) => {
            event.preventDefault();
            const part = ViewContainerPart.closestPart(event.target);
            if (part instanceof HTMLElement) {
                part.classList.remove('drop-target');
            }
        };
        return new DisposableCollection(
            addEventListener(this.header, 'dragstart', event => {
                const { dataTransfer } = event;
                if (dataTransfer) {
                    this.canBeDropTarget = false;
                    dataTransfer.effectAllowed = 'move';
                    dataTransfer.setData('view-container-dnd', this.id);
                    const dragImage = document.createElement('div');
                    dragImage.classList.add('theia-view-container-drag-image');
                    dragImage.innerText = this.wrapped.title.label;
                    document.body.appendChild(dragImage);
                    dataTransfer.setDragImage(dragImage, -10, -10);
                    setTimeout(() => document.body.removeChild(dragImage), 0);
                }
            }, false),
            addEventListener(this.node, 'dragend', () => this.canBeDropTarget = true, false),
            addEventListener(this.node, 'dragover', style, false),
            addEventListener(this.node, 'dragleave', unstyle, false),
            addEventListener(this.node, 'drop', event => {
                const { dataTransfer } = event;
                if (dataTransfer) {
                    const moveId = dataTransfer.getData('view-container-dnd');
                    if (moveId && moveId !== this.id) {
                        this.moveBeforeEmitter.fire(moveId);
                    }
                    unstyle(event);
                }
            }, false)
        );
    }

    protected createContent(): { header: HTMLElement, body: HTMLElement, disposable: Disposable } {
        const disposable = new DisposableCollection();
        const { header, disposable: headerDisposable } = this.createHeader();
        const body = document.createElement('div');
        body.classList.add('body');
        this.node.appendChild(header);
        this.node.appendChild(body);
        disposable.push(headerDisposable);
        return {
            header,
            body,
            disposable,
        };
    }

    protected createHeader(): { header: HTMLElement, disposable: Disposable } {
        const disposable = new DisposableCollection();
        const header = document.createElement('div');
        header.classList.add('theia-header', 'header');
        disposable.push(addEventListener(header, 'click', () => {
            // Cannot collapse/expand if the orientation of the container is `horizontal`.
            if (this.node.closest('#theia-main-content-panel') || this.node.closest('#theia-bottom-content-panel')) {
                return;
            }
            this._collapsed = !this._collapsed;
            this.body.style.display = this._collapsed ? 'none' : 'block';
            // tslint:disable-next-line:no-shadowed-variable
            const toggleIcon = this.header.querySelector(`span.${EXPANSION_TOGGLE_CLASS}`);
            if (toggleIcon) {
                toggleIcon.classList.toggle(COLLAPSED_CLASS);
            }
            this.update();
            this.collapsedEmitter.fire(this._collapsed);
        }));

        const toggleIcon = document.createElement('span');
        toggleIcon.classList.add(EXPANSION_TOGGLE_CLASS);
        if (this._collapsed) {
            toggleIcon.classList.add(COLLAPSED_CLASS);
        }
        header.appendChild(toggleIcon);

        const title = document.createElement('span');
        title.classList.add('label', 'noselect');
        title.innerText = this.wrapped.title.label;
        header.appendChild(title);

        if (ViewContainerPartWidget.is(this.wrapped)) {
            for (const { tooltip, execute, className } of this.wrapped.toolbarElements.filter(e => e.enabled !== false)) {
                const toolbarItem = document.createElement('span');
                toolbarItem.classList.add('element');
                if (className) {
                    // TODO: `className` should be `MaybeArray<string>` or `string | string[]` instead.
                    toolbarItem.classList.add(...className.split(' '));
                }
                toolbarItem.title = tooltip;
                disposable.push(addEventListener(toolbarItem, 'click', async event => {
                    event.stopPropagation();
                    event.preventDefault();
                    await execute();
                    this.update();
                }));
                header.appendChild(toolbarItem);
            }
        }
        return {
            header,
            disposable
        };
    }

    protected onAfterAttach(msg: Message): void {
        MessageLoop.sendMessage(this.wrapped, Widget.Msg.BeforeAttach);
        if (this.wrapped.isAttached) {
            Widget.detach(this.wrapped);
        }
        Widget.attach(this.wrapped, this.body);
        MessageLoop.sendMessage(this.wrapped, Widget.Msg.AfterAttach);
        this.update();
        super.onAfterAttach(msg);
    }

    protected onUpdateRequest(msg: Message): void {
        if (this.wrapped.isAttached) {
            this.wrapped.update();
        }
        super.onUpdateRequest(msg);
    }

}

export namespace ViewContainerPart {

    export interface State {
        partId: string
        hidden: boolean
    }

    export function closestPart(element: Element | EventTarget | null, selector: string = 'div.part'): Element | undefined {
        if (element instanceof Element) {
            const part = element.closest(selector);
            if (part instanceof Element) {
                return part;
            }
        }
        return undefined;
    }
}

export interface ViewContainerPartToolbarElement {
    /** default true */
    readonly enabled?: boolean
    readonly className: string // TODO: `string | string[]`
    readonly tooltip: string
    // tslint:disable-next-line:no-any
    execute(): any
}

export interface ViewContainerPartWidget extends Widget {
    readonly toolbarElements: ViewContainerPartToolbarElement[];
}

export namespace ViewContainerPartWidget {
    export function is(widget: Widget | undefined): widget is ViewContainerPartWidget {
        return !!widget && ('toolbarElements' in widget);
    }
}
