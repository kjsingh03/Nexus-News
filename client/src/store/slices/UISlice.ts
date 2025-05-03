import { createSlice, PayloadAction } from "@reduxjs/toolkit"

const initialState = {
    navOpen: false,
}

const uiSlice = createSlice({
    name: "ui",
    initialState,
    reducers: {
        setNavOpen: (state, action: PayloadAction<boolean>) => {
            state.navOpen = action.payload
        }
    }
})

export const { setNavOpen } = uiSlice.actions;

export default uiSlice.reducer;