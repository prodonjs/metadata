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
import Checkbox, {CheckboxProps} from '@material-ui/core/Checkbox';
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import ChevronRight from '@material-ui/icons/ChevronRight';
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import Radio from '@material-ui/core/Radio';
import TextField, {TextFieldProps} from '@material-ui/core/TextField';
import Tooltip from '@material-ui/core/Tooltip';
import WarningIcon from '@material-ui/icons/WarningRounded';
import {classes, stylesheet} from 'typestyle';
import {fonts, fontsize, dimension, commonCss, color, padding, zIndex} from '../Css';
import {logger} from '../lib/Utils';

export enum ExpandState {
  COLLAPSED,
  EXPANDED,
  NONE,
}

export interface Column {
  flex?: number;
  label: string;
  customRenderer?: React.FC<CustomRendererProps<any>>;
}

export interface CustomRendererProps<T> {
  value?: T;
  id: string;
}

export interface Row {
  expandState?: ExpandState;
  error?: string;
  id: string;
  otherFields: any[];
}

const rowHeight = 40;

export const css = stylesheet({
  cell: {
    $nest: {
      '&:not(:nth-child(2))': {
        color: color.inactive,
      },
    },
    alignSelf: 'center',
    borderBottom: 'initial',
    color: color.foreground,
    fontFamily: fonts.secondary,
    fontSize: fontsize.base,
    letterSpacing: 0.25,
    marginRight: 20,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  columnName: {
    color: '#1F1F1F',
    fontSize: fontsize.small,
    fontWeight: 'bold',
    letterSpacing: 0.25,
    marginRight: 20,
  },
  emptyMessage: {
    padding: 20,
    textAlign: 'center',
  },
  expandButton: {
    marginRight: 10,
    padding: 3,
    transition: 'transform 0.3s',
  },
  expandButtonExpanded: {
    transform: 'rotate(90deg)',
  },
  expandableContainer: {
    transition: 'margin 0.2s',
  },
  expandedContainer: {
    borderRadius: 10,
    boxShadow: '0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)',
    margin: '16px 2px',
  },
  expandedRow: {
    borderBottom: '1px solid transparent !important',
    boxSizing: 'border-box',
    height: '40px !important',
  },
  footer: {
    borderBottom: '1px solid ' + color.divider,
    fontFamily: fonts.secondary,
    height: 40,
    textAlign: 'right',
  },
  header: {
    borderBottom: 'solid 1px ' + color.divider,
    color: color.strong,
    display: 'flex',
    flex: '0 0 40px',
    lineHeight: '40px', // must declare px
  },
  icon: {
    color: color.alert,
    height: 18,
    paddingRight: 4,
    verticalAlign: 'sub',
    width: 18,
  },
  noLeftPadding: {
    paddingLeft: 0,
  },
  noMargin: {
    margin: 0,
  },
  row: {
    $nest: {
      '&:hover': {
        backgroundColor: '#f3f3f3',
      },
    },
    borderBottom: '1px solid #ddd',
    display: 'flex',
    flexShrink: 0,
    height: rowHeight,
    outline: 'none',
  },
  rowsPerPage: {
    color: color.strong,
    height: dimension.xsmall,
    minWidth: dimension.base,
  },
  selected: {
    backgroundColor: color.activeBg,
  },
  selectionToggle: {
    marginRight: 12,
    minWidth: 32,
  },
  verticalAlignInitial: {
    verticalAlign: 'initial',
  },
});

interface CustomTableProps {
  columns: Column[];
  disablePaging?: boolean;
  disableSelection?: boolean;
  emptyMessage?: string;
  reload: (request: any) => Promise<string>;
  rows: Row[];
  selectedIds?: string[];
  updateSelection?: (selectedIds: string[]) => void;
  useRadioButtons?: boolean;
}

interface CustomTableState {
  currentPage: number;
  isBusy: boolean;
  maxPageIndex: number;
  pageSize: number;
  tokenList: string[];
}

export default class CustomTable extends React.Component<CustomTableProps, CustomTableState> {
  private _isMounted = true;

  constructor(props: CustomTableProps) {
    super(props);

    this.state = {
      currentPage: 0,
      isBusy: false,
      maxPageIndex: Number.MAX_SAFE_INTEGER,
      pageSize: 10,
      tokenList: [''],
    };
  }

  public handleSelectAllClick(event: React.ChangeEvent): void {
    if (this.props.disableSelection === true) {
      // This should be impossible to reach
      return;
    }
    const selectedIds =
      (event.target as CheckboxProps).checked ? this.props.rows.map((v) => v.id) : [];
    if (this.props.updateSelection) {
      this.props.updateSelection(selectedIds);
    }
  }

  public handleClick(e: React.MouseEvent, id: string): void {
    if (this.props.disableSelection === true) {
      return;
    }

    let newSelected = [];
    if (this.props.useRadioButtons) {
      newSelected = [id];
    } else {
      const selectedIds = this.props.selectedIds || [];
      const selectedIndex = selectedIds.indexOf(id);
      newSelected = selectedIndex === -1 ?
        selectedIds.concat(id) :
        selectedIds.slice(0, selectedIndex).concat(selectedIds.slice(selectedIndex + 1));
    }

    if (this.props.updateSelection) {
      this.props.updateSelection(newSelected);
    }

    e.stopPropagation();
  }

  public isSelected(id: string): boolean {
    return !!this.props.selectedIds && this.props.selectedIds.indexOf(id) !== -1;
  }

  public componentDidMount(): void {
    this._pageChanged(0);
  }

  public componentWillUnmount(): void {
    this._isMounted = false;
  }

  public render(): JSX.Element {
    const {pageSize} = this.state;
    const numSelected = (this.props.selectedIds || []).length;
    const totalFlex = this.props.columns.reduce((total, c) => total += (c.flex || 1), 0);
    const widths = this.props.columns.map(c => (c.flex || 1) / totalFlex * 100);

    return (
      <div className={commonCss.pageOverflowHidden}>

        {/* Header */}
        <div className={classes(
          css.header, (this.props.disableSelection || this.props.useRadioButtons) && padding(20, 'l'))}>
          {(this.props.disableSelection !== true && this.props.useRadioButtons !== true) && (
            <div className={classes(css.columnName, css.cell, css.selectionToggle)}>
              <Checkbox indeterminate={!!numSelected && numSelected < this.props.rows.length}
                color='primary' checked={!!numSelected && numSelected === this.props.rows.length}
                onChange={this.handleSelectAllClick.bind(this)} />
            </div>
          )}
          {this.props.columns.map((col, i) => {
            return (
              <div key={i} style={{width: widths[i] + '%'}} className={css.columnName}>
                <div>{col.label}</div>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className={commonCss.scrollContainer} style={{minHeight: 60}}>
          {/* Busy experience */}
          {this.state.isBusy && (<React.Fragment>
            <div className={commonCss.busyOverlay} />
            <CircularProgress size={25} className={commonCss.absoluteCenter}
              style={{zIndex: zIndex.BUSY_OVERLAY}} />
          </React.Fragment>)}

          {/* Empty experience */}
          {this.props.rows.length === 0 && !!this.props.emptyMessage && !this.state.isBusy && (
            <div className={css.emptyMessage}>{this.props.emptyMessage}</div>
          )}
          {this.props.rows.map((row, i) => {
            if (row.otherFields.length !== this.props.columns.length) {
              logger.error('Rows must have the same number of cells defined in columns');
              return null;
            }
            return (<div className={classes(css.expandableContainer)} key={i}>
              <div role='checkbox' tabIndex={-1} className={
                classes(
                  'tableRow',
                  css.row,
                  this.props.disableSelection === true && padding(20, 'l'),
                  this.isSelected(row.id) && css.selected,
                )}
                onClick={e => this.handleClick(e, row.id)}>
                {(this.props.disableSelection !== true) && (
                  <div className={classes(css.cell, css.selectionToggle)}>
                    {/* If using checkboxes */}
                    {(this.props.useRadioButtons !== true) && (
                      <Checkbox color='primary' checked={this.isSelected(row.id)} />)}
                    {/* If using radio buttons */}
                    {(this.props.useRadioButtons) && (
                      <Radio color='primary' checked={this.isSelected(row.id)} />)}
                  </div>
                )}
                {row.otherFields.map((cell, c) => (
                  <div key={c} style={{width: widths[c] + '%'}} className={css.cell}>
                    {c === 0 && row.error && (
                      <Tooltip title={row.error}><WarningIcon className={css.icon} /></Tooltip>
                    )}
                    {this.props.columns[c].customRenderer ?
                      this.props.columns[c].customRenderer!({value: cell, id: row.id}) : cell}
                  </div>
                ))}
              </div>
            </div>);
          })}
        </div>

        {/* Footer */}
        {!this.props.disablePaging && (
          <div className={css.footer}>
            <span className={padding(10, 'r')}>Rows per page:</span>
            <TextField select={true} variant='standard' className={css.rowsPerPage}
              classes={{root: css.verticalAlignInitial}}
              InputProps={{disableUnderline: true}} onChange={this._requestRowsPerPage.bind(this)}
              value={pageSize}>
              {[10, 20, 50, 100].map((size, i) => (
                <MenuItem key={i} value={size}>{size}</MenuItem>
              ))}
            </TextField>

            <IconButton onClick={() => this._pageChanged(-1)} disabled={!this.state.currentPage}>
              <ChevronLeft />
            </IconButton>
            <IconButton onClick={() => this._pageChanged(1)}
              disabled={this.state.currentPage >= this.state.maxPageIndex}>
              <ChevronRight />
            </IconButton>
          </div>
        )}
      </div>
    );
  }

  public async reload(loadRequest?: any): Promise<string> {
    // Override the current state with incoming request
    const request = Object.assign({
      pageSize: this.state.pageSize,
      pageToken: this.state.tokenList[this.state.currentPage],
    }, loadRequest);

    let result = '';
    try {
      this.setStateSafe({
        isBusy: true,
        pageSize: request.pageSize,
      });

      result = await this.props.reload(request);
    } finally {
      this.setStateSafe({isBusy: false});
    }
    return result;
  }

  private setStateSafe(newState: Partial<CustomTableState>, cb?: () => void): void {
    if (this._isMounted) {
      this.setState(newState as any, cb);
    }
  }

  private async _pageChanged(offset: number): Promise<void> {
    let newCurrentPage = this.state.currentPage + offset;
    let maxPageIndex = this.state.maxPageIndex;
    newCurrentPage = Math.max(0, newCurrentPage);
    newCurrentPage = Math.min(this.state.maxPageIndex, newCurrentPage);

    const newPageToken = await this.reload({
      pageToken: this.state.tokenList[newCurrentPage],
    });

    if (newPageToken) {
      // If we're using the greatest yet known page, then the pageToken will be new.
      if (newCurrentPage + 1 === this.state.tokenList.length) {
        this.state.tokenList.push(newPageToken);
      }
    } else {
      maxPageIndex = newCurrentPage;
    }

    this.setStateSafe({currentPage: newCurrentPage, maxPageIndex});
  }

  private async _requestRowsPerPage(event: React.ChangeEvent): Promise<void> {
    const pageSize = (event.target as TextFieldProps).value as number;

    this._resetToFirstPage(await this.reload({pageSize, pageToken: ''}));
  }

  private _resetToFirstPage(newPageToken?: string): void {
    let maxPageIndex = Number.MAX_SAFE_INTEGER;
    const newTokenList = [''];

    if (newPageToken) {
      newTokenList.push(newPageToken);
    } else {
      maxPageIndex = 0;
    }

    // Reset state, since this invalidates the token list and page counter calculations
    this.setStateSafe({
      currentPage: 0,
      maxPageIndex,
      tokenList: newTokenList,
    });
  }
}
