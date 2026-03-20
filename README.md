# WorkOrderTimelineApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.1.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Libraries Used

- Angular v19.1.0
  - Required framework for the assessment and needed to use Angular v17+
- popperjs v2.11.8
  - Required to make ng-bootstrap cooperate, as it is a peer dependency
- karma v6.4.0
  - Utilized to run unit tests with jasmine
- ng-bootstrap v17.0.1
  - Used to gain access to the `ngb-datepicker` element for date picking
- ng-select v12.0.0
  - Used for dropdown selection input fields in lieu of `<select>` elements

## Known Issues

- A work order's start and end dates are 12 AM on the date, making it impossible to create or edit work orders to a specific hour on a given date
-  `work-order-panel` component
  - `Cancel` and `Create` buttons
    - Need to add a focused color for when navigating the form using tab or tab + shift
    - `Cancel` button border looks strange when hovering or clicking on the button
  - Ensure active input field color is accurate (`border: 2px solid rgba(170, 175, 255, 1); border-radius: 5px;`)
- Smaller/mobile screens need adjustment

## Future Upgrades

- Add a 'Today' button to quickly snap the user to the current period line
- Add localStorage persistence
- Add ability to create a new work center
- Add tooltip when hovering over work order to display name, status, and full date range