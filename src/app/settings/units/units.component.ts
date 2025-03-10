import { Component, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl }    from '@angular/forms';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { NotificationsService } from '../../core/services/notifications.service';

import { IUnitDefaults, UnitsService, IUnit } from '../../core/services/units.service';

@Component({
  selector: 'settings-units',
  templateUrl: './units.component.html',
  styleUrls: ['./units.component.scss']
})
export class SettingsUnitsComponent implements OnInit {

  formUnitMaster: UntypedFormGroup;

  groupUnits: {[key: string]: IUnit}[] = [];
  defaultUnits: IUnitDefaults;



  constructor(
    private UnitsService: UnitsService,
    private appSettingsService: AppSettingsService,
    private notificationsService: NotificationsService,
    ) { }

  ngOnInit() {

    this.defaultUnits = this.appSettingsService.getDefaultUnits();

    //format unit group data a bit better for consumption in template
    let unitGroupsRaw = this.UnitsService.getConversions();

    for (let gindex = 0; gindex < unitGroupsRaw.length; gindex++) {
      const unitGroup = unitGroupsRaw[gindex];
      let units = [];

      for (let index = 0; index < unitGroup.units.length; index++) {
        const unit = unitGroup.units[index];
        units.push(unit);
      }
      this.groupUnits[unitGroup.group] = units;
    }

    //generate formGroup
    let groups = new UntypedFormGroup({});
    Object.keys(this.defaultUnits).forEach(key => {
      groups.addControl(key, new UntypedFormControl(this.defaultUnits[key]));
    });

    this.formUnitMaster = groups;
    this.formUnitMaster.updateValueAndValidity();
    //console.log(this.formUnitMaster);
  }

  submitConfig() {
    this.appSettingsService.setDefaultUnits(this.formUnitMaster.value);
    this.notificationsService.sendSnackbarNotification("Default units configuration saved", 5000, false);
  }

}
