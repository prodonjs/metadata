/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import CustomTable, {CustomRendererProps, Column, Row} from '../components/CustomTable';
import {Page} from './Page';
import {ToolbarProps} from '../components/Toolbar';
import {classes} from 'typestyle';
import {commonCss, padding} from '../Css';
import {formatDateString, getArtifactProperty} from '../lib/Utils';
import {Api, ArtifactProperties, ArtifactCustomProperties} from '../lib/Api';
import {MlMetadataArtifact, MlMetadataArtifactType} from '../apis/service/api';
import {Link} from 'react-router-dom';
import {RoutePage, RouteParams} from '../components/Router';

interface PipelineListState {
  artifacts: MlMetadataArtifact[];
}

class ArtifactList extends Page<{}, PipelineListState> {
  private tableRef = React.createRef<CustomTable>();
  private api = Api.getInstance();
  private artifactTypes: Map<string, MlMetadataArtifactType>;
  private nameCustomRenderer: React.FC<CustomRendererProps<string>> =
    (props: CustomRendererProps<string>) => {
      const [artifactType, artifactId] = props.id.split(':');
      const link = RoutePage.ARTIFACT_DETAILS
        .replace(`:${RouteParams.ARTIFACT_TYPE}+`, artifactType)
        .replace(`:${RouteParams.ID}`, artifactId);
      return (
        <Link onClick={(e) => e.stopPropagation()}
          className={commonCss.link}
          to={link}>
          {props.value}
        </Link>
      );
    }

  constructor(props: any) {
    super(props);
    this.state = {
      artifacts: [],
    };
    this.reload = this.reload.bind(this);
  }

  public getInitialToolbarState(): ToolbarProps {
    return {
      actions: [],
      breadcrumbs: [],
      pageTitle: 'Artifacts',
    };
  }

  public render(): JSX.Element {
    const columns: Column[] = [
      {label: 'Name', flex: 1, customRenderer: this.nameCustomRenderer},
      {label: 'Version', flex: 1},
      {label: 'Type', flex: 2},
      {label: 'URI', flex: 2},
      {label: 'Workspace', flex: 1},
      {label: 'Created at', flex: 1},
    ];

    const rows: Row[] = this.state.artifacts
      .filter((a) => !!a.properties) // We can't show much without properties
      .map((a) => {
        const type = this.artifactTypes && this.artifactTypes.get(a.type_id!) ?
          this.artifactTypes.get(a.type_id!)!.name : a.type_id;
        return {
          id: `${type}:${a.id}`, // Join with colon so we can build the link
          otherFields: [
            getArtifactProperty(a, ArtifactProperties.NAME),
            getArtifactProperty(a, ArtifactProperties.VERSION),
            type,
            a.uri,
            getArtifactProperty(a, ArtifactCustomProperties.WORKSPACE, true),
            formatDateString(
              getArtifactProperty(a, ArtifactProperties.CREATE_TIME) || ''),
          ],
        };
      });

    return (
      <div className={classes(commonCss.page, padding(20, 'lr'))}>
        <CustomTable ref={this.tableRef}
          columns={columns}
          rows={rows}
          disablePaging={true}
          disableSelection={true}
          reload={this.reload}
          emptyMessage='No artifacts found.' />
      </div>
    );
  }

  public async refresh(): Promise<void> {
    if (this.tableRef.current) {
      await this.tableRef.current.reload();
    }
  }

  private async reload(): Promise<string> {
    // TODO: Consider making an Api method for returning and caching types
    if (!this.artifactTypes || !this.artifactTypes.size) {
      this.artifactTypes = await this.getArtifactTypes();
    }
    try {
      const response = await this.api.metadataService.listArtifacts2();
      this.setStateSafe({artifacts: (response && response.artifacts) || []});
      this.clearBanner();
    } catch (err) {
      this.showPageError('Unable to retrieve Artifacts.', err);
    }
    return '';
  }

  private async getArtifactTypes():
    Promise<Map<string, MlMetadataArtifactType>> {
    try {
      const response = await this.api.metadataService.listArtifactTypes();
      return new Map(
        response.artifact_types!.map((at) => [at.id!, at])
      );
    } catch (err) {
      this.showPageError(
        'Unable to retrieve Artifact Types, some features may not work.', err);
      return new Map();
    }
  }
}

export default ArtifactList;
