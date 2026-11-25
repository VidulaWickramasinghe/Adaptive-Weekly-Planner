import {test,expect} from "@playwright/test";
test("planning preview validates its daily window",async({page})=>{
 await page.goto("/sign-in");
 await page.getByLabel("Email address").fill(process.env.TEST_USER_A_EMAIL!);
 await page.getByLabel("Password",{exact:true}).fill(process.env.TEST_USER_A_PASSWORD!);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(page).toHaveURL("/");
 await page.goto("/proposal");
 await expect(page.getByRole("heading",{name:"Scheduling preview"})).toBeVisible();
 await page.getByLabel("Start hour").fill("20");
 await page.getByLabel("End hour").fill("10");
 await page.getByRole("button",{name:"Generate proposal"}).click();
 await expect(page.getByRole("alert").filter({hasText:"Choose a valid"})).toBeVisible();
});
