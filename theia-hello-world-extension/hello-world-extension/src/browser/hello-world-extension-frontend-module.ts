/**
 * Generated using theia-extension-generator
 */

import { HelloWorldExtensionCommandContribution, HelloWorldExtensionMenuContribution } from './hello-world-extension-contribution';
import {
    CommandContribution,
    MenuContribution
} from "@theia/core/lib/common";

import { ContainerModule } from "inversify";

export default new ContainerModule(bind => {
    // add your contribution bindings here
    
    bind(CommandContribution).to(HelloWorldExtensionCommandContribution);
    bind(MenuContribution).to(HelloWorldExtensionMenuContribution);
    
});