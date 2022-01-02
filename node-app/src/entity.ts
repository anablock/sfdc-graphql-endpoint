import { camelCase } from './utils/string.js';

import {
    DescribeSObjectResult,
    SObjectChildRelationship,
    SObjectField,
    SObjectFieldType,
} from './sfdc/types/describe-sobject.js';

export interface Entity {
    sfdcName: string;
    gqlName: string;
    config: EntityConfig;
    fields: Field[];
    childRelationships: ChildRelationship[];
}

export interface ChildRelationship {
    sfdcName: string;
    gqlName: string;
    entity: string;
}

export interface EntityConfig {
    createable: boolean;
    updateable: boolean;
    deletable: boolean;
    queryable: boolean;
}

interface BaseField<T extends FieldType> {
    type: T;
    sfdcName: string;
    gqlName: string;
    config: FieldConfig;
}

export interface FieldConfig {
    nillable: boolean;
    createable: boolean;
    updateable: boolean;
    filterable: boolean;
    groupable: boolean;
    sortable: boolean;
    aggregatable: boolean;
}

export const enum FieldType {
    STRING = 'String',
    BOOLEAN = 'Boolean',
    INT = 'Int',
    FLOAT = 'Float',
    DATE = 'Date',
    DATETIME = 'DateTime',
    BASE64 = 'Base64',
    ID = 'Id',
    CURRENCY = 'Currency',
    TEXTAREA = 'TextArea',
    PERCENT = 'Percent',
    PHONE = 'Phone',
    URL = 'URL',
    EMAIL = 'Email',
    ANY_TYPE = ' AnyType',
    ADDRESS = 'Address',
    LOCATION = 'Location',
    PICKLIST = 'Picklist',
    MULTI_PICKLIST = 'MultiPicklist',
    COMBOBOX = 'ComboBox',
    REFERENCE = 'Reference',
    POLYMORPHIC_REFERENCE = 'PolymorphicReference',
}

export type ScalarField =
    | BaseField<FieldType.STRING>
    | BaseField<FieldType.BOOLEAN>
    | BaseField<FieldType.INT>
    | BaseField<FieldType.FLOAT>
    | BaseField<FieldType.DATE>
    | BaseField<FieldType.DATETIME>
    | BaseField<FieldType.BASE64>
    | BaseField<FieldType.ID>
    | BaseField<FieldType.CURRENCY>
    | BaseField<FieldType.TEXTAREA>
    | BaseField<FieldType.PERCENT>
    | BaseField<FieldType.PHONE>
    | BaseField<FieldType.URL>
    | BaseField<FieldType.EMAIL>
    | BaseField<FieldType.ANY_TYPE>
    | BaseField<FieldType.EMAIL>
    | BaseField<FieldType.ADDRESS>
    | BaseField<FieldType.LOCATION>
    | BaseField<FieldType.PICKLIST>
    | BaseField<FieldType.MULTI_PICKLIST>
    | BaseField<FieldType.COMBOBOX>;

export interface ReferenceField extends BaseField<FieldType.REFERENCE> {
    sfdcRelationshipName: string;
    sfdcReferencedEntityName: string;
}

export interface PolymorphicReferenceField extends BaseField<FieldType.POLYMORPHIC_REFERENCE> {
    sfdcRelationshipName: string;
    sfdcReferencedEntitiesNames: string[];
}

export type Field = ScalarField | ReferenceField | PolymorphicReferenceField;

const SOBJECT_FIELD_SCALAR_TYPE_MAPPING: {
    [type in Exclude<SObjectFieldType, 'reference'>]: ScalarField['type'];
} = {
    string: FieldType.STRING,
    boolean: FieldType.BOOLEAN,
    int: FieldType.INT,
    double: FieldType.FLOAT,
    date: FieldType.DATE,
    datetime: FieldType.DATETIME,
    base64: FieldType.BASE64,
    id: FieldType.ID,
    currency: FieldType.CURRENCY,
    textarea: FieldType.TEXTAREA,
    percent: FieldType.PERCENT,
    phone: FieldType.PHONE,
    url: FieldType.URL,
    email: FieldType.EMAIL,
    combobox: FieldType.COMBOBOX,
    picklist: FieldType.PICKLIST,
    multipicklist: FieldType.MULTI_PICKLIST,
    anyType: FieldType.ANY_TYPE,
    address: FieldType.ADDRESS,
    location: FieldType.LOCATION,
};

function createField(sObjectField: SObjectField): Field | undefined {
    const {
        name: sfdcName,
        type,
        nillable,
        createable,
        updateable,
        filterable,
        groupable,
        sortable,
        aggregatable,
    } = sObjectField;

    const config = {
        nillable,
        createable,
        updateable,
        filterable,
        groupable,
        sortable,
        aggregatable,
    };

    if (type === 'reference') {
        // Ignores the reference field when it doesn't have a relationship name. This shouldn't be
        // possible per the documentation, however it is the case for "DelegatedApproverId" field
        // the standard "Account" object.
        if (!sObjectField.relationshipName) {
            return;
        }

        const baseReferenceField = {
            sfdcName,
            gqlName: camelCase(sObjectField.relationshipName),
            sfdcRelationshipName: sObjectField.relationshipName,
            config,
        };

        if (sObjectField.polymorphicForeignKey) {
            return {
                type: FieldType.POLYMORPHIC_REFERENCE,
                sfdcReferencedEntitiesNames: sObjectField.referenceTo,
                ...baseReferenceField,
            };
        } else {
            return {
                type: FieldType.REFERENCE,
                sfdcReferencedEntityName: sObjectField.referenceTo[0],
                ...baseReferenceField,
            };
        }
    } else {
        // TODO: What should be done with compound fields? Compound fields contains duplicate
        // information, that will be present in other fields.
        // For example: 
        //  - name -> first name + last name
        //  - address -> address city + address street + ...
        return {
            type: SOBJECT_FIELD_SCALAR_TYPE_MAPPING[type],
            sfdcName,
            gqlName: camelCase(sObjectField.name),
            config,
        };
    }
}

function createChildRelationShip(
    relationship: SObjectChildRelationship,
): ChildRelationship | undefined {
    if (relationship.relationshipName === null) {
        return;
    }

    return {
        sfdcName: relationship.relationshipName,
        gqlName: camelCase(relationship.relationshipName),
        entity: relationship.childSObject,
    };
}

export function createEntity(sObject: DescribeSObjectResult): Entity {
    const { name, createable, updateable, deletable, queryable } = sObject;

    const fields = sObject.fields
        .map(createField)
        .filter((field): field is Field => field !== undefined);

    const childRelationships = sObject.childRelationships
        .map(createChildRelationShip)
        .filter((rel): rel is ChildRelationship => rel !== undefined);

    return {
        sfdcName: name,
        gqlName: name,
        config: {
            createable,
            updateable,
            deletable,
            queryable,
        },
        fields,
        childRelationships,
    };
}

export function isScalarField(field: Field): field is ScalarField {
    return field.type !== FieldType.REFERENCE && field.type !== FieldType.POLYMORPHIC_REFERENCE;
}

export function assertScalarField(field: Field): asserts field is ScalarField {
    if (!isScalarField(field)) {
        throw new Error(`Expected a scalar field but received a ${field.type}.`);
    }
}

export function isReferenceField(field: Field): field is ReferenceField {
    return field.type === FieldType.REFERENCE;
}

export function assertReferenceField(field: Field): asserts field is ReferenceField {
    if (!isReferenceField(field)) {
        throw new Error(`Expected a reference field but received a ${field.type}.`);
    }
}

export function isPolymorphicReference(field: Field): field is PolymorphicReferenceField {
    return field.type === FieldType.POLYMORPHIC_REFERENCE;
}
