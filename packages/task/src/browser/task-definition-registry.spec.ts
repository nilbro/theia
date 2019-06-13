/********************************************************************************
 * Copyright (C) 2019 Ericsson and others.
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

import { expect } from 'chai';
import { TaskDefinitionRegistryImpl } from './task-definition-registry';

// tslint:disable:no-unused-expression
describe('TaskDefinitionRegistry', () => {
    let registry: TaskDefinitionRegistryImpl;
    const definitonContributionA = {
        type: 'extA',
        required: ['extensionType'],
        properties: {
            extensionType: {
                type: 'string',
                description: 'type or name of the extension / plugin'
            },
            taskLabel: {
                type: 'string',
                description: 'label of the defined task'
            }
        }
    };
    const definitonContributionB = {
        type: 'extA',
        required: ['extensionType', 'taskLabel', 'taskDetailedLabel'],
        properties: {
            extensionType: {
                type: 'string',
                description: 'type or name of the extension / plugin'
            },
            taskLabel: {
                type: 'string',
                description: 'label 1 of the defined task'
            },
            taskDetailedLabel: {
                type: 'string',
                description: 'label 2 of the defined task'
            }
        }
    };

    beforeEach(() => {
        registry = new TaskDefinitionRegistryImpl();
    });

    describe('register function', () => {
        it('should transform the task definition contribution and store it in memory', () => {
            registry.register(definitonContributionA);
            expect(registry['definitions'].get(definitonContributionA.type)).to.be.ok;
            expect(registry['definitions'].get(definitonContributionA.type)![0]).to.deep.equal({
                taskType: definitonContributionA.type,
                properties: {
                    required: definitonContributionA.required,
                    all: Object.keys(definitonContributionA.properties)
                }
            });
        });
    });

    describe('getDefinitions function', () => {
        it('should return all definitions associated with the given type', () => {
            registry.register(definitonContributionA);
            const defs1 = registry.getDefinitions(definitonContributionA.type);
            expect(defs1.length).to.eq(1);

            registry.register(definitonContributionB);
            const defs2 = registry.getDefinitions(definitonContributionA.type);
            expect(defs2.length).to.eq(2);
        });
    });

    describe('getDefinition function', () => {
        it('should return undefined if the given task configuration does not match any registered definitions', () => {
            registry.register(definitonContributionA);
            registry.register(definitonContributionB);
            const defs = registry.getDefinition({
                type: definitonContributionA.type, label: 'grunt task', task: 'build'
            });
            expect(defs).to.be.not.ok;
        });

        it('should return the best match if there is one or more registered definitions match the given task configuration', () => {
            registry.register(definitonContributionA);
            registry.register(definitonContributionB);
            const defs = registry.getDefinition({
                type: definitonContributionA.type, label: 'extention task', extensionType: 'extensionType', taskLabel: 'taskLabel'
            });
            expect(defs).to.be.ok;
            expect(defs!.taskType).to.be.eq(definitonContributionA.type);

            const defs2 = registry.getDefinition({
                type: definitonContributionA.type, label: 'extention task', extensionType: 'extensionType', taskLabel: 'taskLabel', taskDetailedLabel: 'taskDetailedLabel'
            });
            expect(defs2).to.be.ok;
            expect(defs2!.taskType).to.be.eq(definitonContributionB.type);
        });
    });
});
